import {
  StyleSheet,
  Text,
  View,
  Dimensions,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  ActivityIndicator,
  ToastAndroid,
  Alert,
  Platform,
} from 'react-native';
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import * as Network from 'expo-network';
import AntDesign from '@expo/vector-icons/AntDesign';
import DropDownPicker from 'react-native-dropdown-picker';
import { useBluetooth } from 'rn-bluetooth-classic';
import { addDoc, collection, getDocs } from 'firebase/firestore';
import { auth, db } from '../Database/config';
import { store } from '../store/store';
import { useDispatch, useSelector } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { debounce } from 'lodash';

const { width: screenWidth } = Dimensions.get('window');

// Reusable Components
const InputField = ({ value, onChange, placeholder, style, keyboardType }) => (
  <TextInput
    value={value}
    onChangeText={onChange}
    placeholder={placeholder}
    style={[styles.input, style]}
    keyboardType={keyboardType}
    placeholderTextColor="#999"
  />
);

const CustomButton = ({ title, onPress, disabled, style, textStyle, loading, icon }) => (
  <TouchableOpacity
    style={[styles.button, style, disabled && styles.buttonDisabled]}
    onPress={onPress}
    disabled={disabled || loading}
  >
    {loading ? (
      <ActivityIndicator color="#fff" />
    ) : (
      <>
        {icon}
        <Text style={[styles.buttonText, textStyle]}>{title}</Text>
      </>
    )}
  </TouchableOpacity>
);

const ProductRow = React.memo(({ item, index, onDelete }) => (
  <TouchableOpacity onPress={() => onDelete(index)} style={styles.tableRow}>
    <Text style={styles.tableCell} numberOfLines={1}>{item.productType}</Text>
    <Text style={styles.tableCell}>{item.quantity}</Text>
    <Text style={styles.tableCell}>{item.weight}kg</Text>
    <Text style={styles.tableCell}>{`${item.lt || 0}*${item.wd || 0}*${item.ht || 0}`}</Text>
    <Text style={styles.tableCell}>{item.tVol.toFixed(1)} cm³</Text>
  </TouchableOpacity>
));

const RecordPage = ({ route, navigation }) => {
  const { awbnumber, shipper, paymentInfo, senderDetails, receiverDetails } = route.params || {};
  const dispatch = useDispatch();
  const { BusinessId } = useSelector((state) => state.settings);

  // State Management
  const [form, setForm] = useState({
    productType: '',
    destination: '',
    quantity: '',
    length: '',
    width: '',
    height: '',
    tareWeight: '0.00',
    pmcNumber: '',
  });
  const [locations, setLocations] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [dolleyVisible, setDolleyVisible] = useState(false);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState(paymentInfo?.status || 'Unpaid');
  const [infoVisibility, setInfoVisibility] = useState({ sender: false, receiver: false });
  const [scaleData, setScaleData] = useState({
    reading: null,
    rawReading: null,
    isStable: false,
    lastUpdated: null,
  });
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loadingLocations, setLoadingLocations] = useState(true);

  const recentReadingsRef = useRef([]);
  const lastDataTimeRef = useRef(null);
  const isScaleActiveRef = useRef(false);

  const { connectToDevice, receivedData, writeToDevice } = useBluetooth();

  // Optimized Functions
  const validateNumericInput = useCallback((text) => {
    if (text === '') return text;
    return /^\d*\.?\d{0,2}$/.test(text) ? text : '';
  }, []);

  const updateForm = useCallback((field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: ['quantity', 'length', 'width', 'height', 'tareWeight'].includes(field)
        ? validateNumericInput(value)
        : value,
    }));
  }, [validateNumericInput]);

  const calculateTotals = useMemo(() => {
    const totals = products.reduce(
      (acc, item) => ({
        quantity: acc.quantity + parseInt(item.quantity, 10),
        weight: acc.weight + parseFloat(item.weight),
        volume: acc.volume + parseFloat(item.tVol),
      }),
      { quantity: 0, weight: 0, volume: 0 }
    );
    const netWeight = totals.weight - parseFloat(form.tareWeight || 0);
    return {
      totalQuantity: totals.quantity,
      totalWeight: totals.weight.toFixed(2),
      netWeight: netWeight.toFixed(2),
      totalVolume: totals.volume.toFixed(1),
    };
  }, [products, form.tareWeight]);

  // Define dropdownItems
  const dropdownItems = useMemo(() => [
    { label: 'Select Destination', value: '' },
    ...locations.map((location) => ({ label: location.name, value: location.name })),
  ], [locations]);

  // Bluetooth Handling
  const checkStability = useCallback((newReading) => {
    const isZeroReading = Math.abs(newReading) < 0.01;
    recentReadingsRef.current.push(newReading);
    if (recentReadingsRef.current.length > 5) recentReadingsRef.current.shift();

    if (recentReadingsRef.current.length >= 2 && isScaleActiveRef.current) {
      const recentValues = recentReadingsRef.current.slice(-3);
      const min = Math.min(...recentValues);
      const max = Math.max(...recentValues);
      const threshold = 0.1;

      if (isZeroReading && recentValues.every((v) => Math.abs(v) < 0.01)) {
        return false;
      }

      const isCurrentlyStable = max - min <= threshold;
      if (recentReadingsRef.current.length >= 3) {
        const allReadings = [...recentReadingsRef.current];
        const minAll = Math.min(...allReadings);
        const maxAll = Math.max(...allReadings);
        const maintainThreshold = 0.2;
        if (maxAll - minAll <= maintainThreshold) return true;
      }
      return isCurrentlyStable;
    }
    return false;
  }, []);

  const parseBluetoothData = useCallback(
    debounce((data) => {
      let numericValue = null;
      try {
        console.log('Raw receivedData:', data);
        if (typeof data === 'string') {
          try {
            const decodedData = atob(data);
            const match = decodedData.match(/-?\d+(\.\d+)?/);
            if (match) numericValue = parseFloat(match[0]);
          } catch {
            const match = data.match(/-?\d+(\.\d+)?/);
            if (match) numericValue = parseFloat(match[0]);
          }
        } else if (typeof data === 'number') {
          numericValue = data;
        } else if (data && typeof data === 'object') {
          const dataString = data.toString ? data.toString() : JSON.stringify(data);
          const match = dataString.match(/-?\d+(\.\d+)?/);
          if (match) numericValue = parseFloat(match[0]);
        }

        console.log('Parsed numericValue:', numericValue);
        if (numericValue !== null && !isNaN(numericValue)) {
          const isCurrentlyStable = checkStability(numericValue);
          setScaleData({
            reading: numericValue.toFixed(2) + ' kg',
            rawReading: numericValue,
            isStable: isCurrentlyStable,
            lastUpdated: Date.now(),
          });
        } else {
          setScaleData({
            reading: null,
            rawReading: null,
            isStable: false,
            lastUpdated: Date.now(),
          });
        }
      } catch (error) {
        console.error('Error parsing Bluetooth data:', error);
        setScaleData({
          reading: null,
          rawReading: null,
          isStable: false,
          lastUpdated: Date.now(),
        });
      }
    }, 100),
    [checkStability]
  );

  // Effects
  useEffect(() => {
    const fetchLocations = async () => {
      setLoadingLocations(true);
      try {
        const locationsRef = collection(db, 'locations');
        const querySnapshot = await getDocs(locationsRef);
        const locationsData = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          name: doc.data().name || 'Unknown',
        }));
        console.log('Fetched locations:', locationsData);
        setLocations(locationsData);
      } catch (error) {
        console.error('Error fetching locations:', error);
        ToastAndroid.show('Failed to fetch locations', ToastAndroid.SHORT);
      } finally {
        setLoadingLocations(false);
      }
    };
    fetchLocations();
  }, []);

  useEffect(() => {
    console.log('Sender Details:', senderDetails);
    if (receivedData) {
      lastDataTimeRef.current = Date.now();
      isScaleActiveRef.current = true;
      parseBluetoothData(receivedData);
    }
  }, [receivedData, parseBluetoothData, senderDetails]);

  useEffect(() => {
    const inactivityTimer = setInterval(() => {
      if (lastDataTimeRef.current && Date.now() - lastDataTimeRef.current > 5000) {
        isScaleActiveRef.current = false;
        recentReadingsRef.current = [];
        setScaleData((prev) => ({ ...prev, isStable: false }));
      }
    }, 1000);
    return () => clearInterval(inactivityTimer);
  }, []);

  // Data Persistence
  const saveToFirebase = useCallback(async (record) => {
    const recordsRef = collection(db, 'Records');
    await addDoc(recordsRef, record);
    ToastAndroid.show('Record saved to Firebase!', ToastAndroid.LONG);
  }, []);

  const saveToLocalStorage = useCallback(async (record) => {
    const existingRecords = await AsyncStorage.getItem('localRecords');
    const records = existingRecords ? JSON.parse(existingRecords) : [];
    await AsyncStorage.setItem('localRecords', JSON.stringify([...records, record]));
    ToastAndroid.show('Record saved locally!', ToastAndroid.LONG);
  }, []);

  const saveData = useCallback(async () => {
    const { productType, destination } = form;
    if (!productType.trim() || !destination.trim()) {
      Alert.alert('Validation Error', 'Please fill all required fields (Product Type and Destination).');
      return;
    }

    Alert.alert('Confirm Save', 'Are you sure you want to save this record?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Save',
        onPress: async () => {
          setLoading(true);
          try {
            const record = {
              supplier: null,
              awbnumber: awbnumber || null,
              productType: productType.trim(),
              destination: destination.trim(),
              shipper: shipper || null,
              products: products.length > 0 ? products : [],
              netWeight: calculateTotals.netWeight,
              totalWeight: calculateTotals.totalWeight,
              tareWeight: form.tareWeight,
              paymentStatus,
              senderDetails: senderDetails || null,
              receiverDetails: receiverDetails || null,
              createdAt: new Date(),
              userId: auth.currentUser?.uid || null,
              businessId: BusinessId || null,
            };

            try {
              await saveToFirebase(record);
              await saveToLocalStorage(record);
              setModalVisible(true);
            } catch (error) {
              console.error('Firebase save error:', error);
              await saveToLocalStorage(record);
              setModalVisible(true);
              setTimeout(() => {
                Alert.alert(
                  'Record Saved Locally',
                  'Would you like to sync this record to Firebase now?',
                  [
                    { text: 'Later', style: 'cancel' },
                    { text: 'Sync Now', onPress: syncLocalRecordsToFirebase },
                  ]
                );
              }, 1000);
            }
          } catch (error) {
            console.error('Error saving record:', error);
            Alert.alert('Error', `Failed to save: ${error.message}`);
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  }, [
    form,
    awbnumber,
    shipper,
    products,
    calculateTotals,
    paymentStatus,
    senderDetails,
    receiverDetails,
    BusinessId,
    saveToFirebase,
    saveToLocalStorage,
  ]);

  const syncLocalRecordsToFirebase = useCallback(async () => {
    setLoading(true);
    try {
      const networkState = await Network.getNetworkStateAsync();
      if (!networkState.isConnected || !networkState.isInternetReachable) {
        Alert.alert('No Internet', 'Please connect to the internet to sync records.');
        return;
      }

      const localRecordsJson = await AsyncStorage.getItem('localRecords');
      if (!localRecordsJson) {
        ToastAndroid.show('No local records to sync', ToastAndroid.SHORT);
        return;
      }

      const localRecords = JSON.parse(localRecordsJson);
      let syncedCount = 0;

      for (const record of localRecords) {
        try {
          await addDoc(collection(db, 'Records'), {
            ...record,
            syncedAt: new Date(),
            userId: auth.currentUser?.uid || null,
            businessId: BusinessId || null,
          });
          syncedCount++;
        } catch (error) {
          console.error('Error syncing record:', error);
        }
      }

      if (syncedCount === localRecords.length) {
        await AsyncStorage.removeItem('localRecords');
        ToastAndroid.show(`Successfully synced ${syncedCount} records to Firebase!`, ToastAndroid.LONG);
      } else {
        ToastAndroid.show(`Synced ${syncedCount} of ${localRecords.length} records.`, ToastAndroid.LONG);
      }
    } catch (error) {
      console.error('Sync error:', error);
      Alert.alert('Sync Error', `Failed to sync: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [BusinessId]);

  const showPrinterReceipt = useCallback(async () => {
    try {
      const receiptData = [
        '    ====== SCALESTECH =====\n\n',
        ` Category: ${'N/A'.padEnd(10)}\n`,
        ` ULD Number: ${(form.pmcNumber || '').padEnd(10)}\n`,
        ` AWB: ${(awbnumber || 'Unknown').padEnd(10)}\n`,
        ` Destination: ${(form.destination || 'Unknown').padEnd(10)}\n`,
        ` Shipper: ${(shipper || 'N/A').padEnd(10)}\n`,
        ` Sender: ${(senderDetails?.name || 'Unknown').padEnd(10)}\n`,
        ` Receiver: ${(receiverDetails?.name || 'Unknown').padEnd(10)}\n`,
        ` Payment: ${(paymentStatus || 'Unpaid').padEnd(10)}\n`,
        ` Date:${new Date().toLocaleDateString().padEnd(9)} Time:${new Date().toLocaleTimeString()}\n\n`,
        '---------- Products ---------\n',
        'Item   Qty    wgt(Kg)    Dim(cm)  \n',
        ...products.map((item) => {
          const { label = item.productType || 'Unknown', quantity = 0, weight = 0, lt = 0, wd = 0, ht = 0 } = item;
          return `${label.padEnd(8)} ${quantity.toString().padStart(2)} ${parseFloat(weight).toFixed(2).padStart(9)} ${`${lt}*${wd}*${ht}`.padStart(9)}\n`;
        }),
        '----------------------\n',
        `GW:    ${calculateTotals.totalQuantity.toString().padStart(4)}   ${calculateTotals.totalWeight.padStart(8)} Kg\n\n`,
        `Tare Weight: ${(form.tareWeight || '0.00').toString().padStart(6)} Kg\n`,
        `Net Weight: ${calculateTotals.netWeight.toString().padStart(6)} Kg\n\n\n\n`,
        '   Thank you for your business!\n',
        '   ===========================\n\n\n',
      ].join('');

      writeToDevice(store.getState().settings.printerAddress, receiptData, 'ascii');
    } catch (error) {
      console.error('Error generating receipt:', error);
      ToastAndroid.show('Failed to generate receipt', ToastAndroid.SHORT);
    }
  }, [awbnumber, shipper, senderDetails, receiverDetails, form, products, calculateTotals, paymentStatus]);

  const handleDelete = useCallback(
    (index) =>
      Alert.alert('Confirm Deletion', 'Are you sure you want to delete this product?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          onPress: () => setProducts((prev) => prev.filter((_, i) => i !== index)),
          style: 'destructive',
        },
      ]),
    []
  );

  const resetStability = useCallback(() => {
    recentReadingsRef.current = [];
    setScaleData({ reading: null, rawReading: null, isStable: false, lastUpdated: null });
    ToastAndroid.show('Scale reset successfully', ToastAndroid.SHORT);
  }, []);

  const captureProduct = useCallback(() => {
    if (!scaleData.isStable) {
      ToastAndroid.show('Please wait for scale to stabilize', ToastAndroid.SHORT);
      return;
    }

    console.log('Capturing product with scaleData:', scaleData);
    Alert.alert(
      'Confirm Capture',
      `Are you sure you want to capture this product?\nWeight: ${scaleData.reading}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'OK',
          onPress: () => {
            const length = parseFloat(form.length) || 0;
            const width = parseFloat(form.width) || 0;
            const height = parseFloat(form.height) || 0;
            const quantity = parseFloat(form.quantity) || 1;
            const totalVolume = length * width * height * quantity;

            if (scaleData.rawReading) {
              setProducts((prev) => [
                ...prev,
                {
                  quantity: form.quantity,
                  weight: scaleData.rawReading.toFixed(2),
                  productType: form.productType,
                  tVol: totalVolume,
                  ht: height,
                  wd: width,
                  lt: length,
                },
              ]);
              console.log('Captured product weight:', scaleData.rawReading.toFixed(2));
              setForm((prev) => ({
                ...prev,
                quantity: '',
                length: '',
                width: '',
                height: '',
              }));
              ToastAndroid.show('Product captured successfully!', ToastAndroid.SHORT);
            } else {
              ToastAndroid.show('No valid weight reading', ToastAndroid.SHORT);
            }
          },
        },
      ]
    );
  }, [scaleData, form]);

  return (
    <ScrollView
      style={styles.container}
      nestedScrollEnabled={true} // Enable nested scrolling to mitigate VirtualizedList conflict
    >
      <View style={styles.innerContainer}>
        <View style={styles.paymentStatusContainer}>
          <Text style={styles.paymentStatusText}>Payment Status: {paymentStatus}</Text>
        </View>

        <CustomButton
          title={infoVisibility.sender ? 'Hide Sender Info' : 'Show Sender Info'}
          onPress={() => setInfoVisibility((prev) => ({ ...prev, sender: !prev.sender }))}
          style={styles.infoToggleButton}
          textStyle={styles.infoToggleText}
        />
        {infoVisibility.sender && (
          <View style={styles.infoContainer}>
            <Text style={styles.infoTitle}>Sender Information</Text>
            {['name', 'phone', 'idNumber', 'staffName'].map((key) => (
              <Text key={key} style={styles.infoText}>
                {key.charAt(0).toUpperCase() + key.slice(1)}: {senderDetails?.[key] || 'N/A'}
              </Text>
            ))}
          </View>
        )}

        <CustomButton
          title={infoVisibility.receiver ? 'Hide Receiver Info' : 'Show Receiver Info'}
          onPress={() => setInfoVisibility((prev) => ({ ...prev, receiver: !prev.receiver }))}
          style={styles.infoToggleButton}
          textStyle={styles.infoToggleText}
        />
        {infoVisibility.receiver && (
          <View style={styles.infoContainer}>
            <Text style={styles.infoTitle}>Receiver Information</Text>
            {['name', 'phone', 'idNumber'].map((key) => (
              <Text key={key} style={styles.infoText}>
                {key.charAt(0).toUpperCase() + key.slice(1)}: {receiverDetails?.[key] || 'N/A'}
              </Text>
            ))}
          </View>
        )}

        <InputField
          value={form.productType}
          onChange={(text) => updateForm('productType', text)}
          placeholder="Product Type"
        />

        <View style={styles.dropdownContainer}>
          {loadingLocations ? (
            <ActivityIndicator size="small" color="#2196F3" />
          ) : (
            <DropDownPicker
              open={dropdownOpen}
              value={form.destination}
              items={dropdownItems}
              setOpen={setDropdownOpen}
              setValue={(callback) => {
                const newValue = callback(form.destination);
                updateForm('destination', newValue);
              }}
              style={styles.picker}
              containerStyle={styles.pickerContainer}
              dropDownContainerStyle={styles.dropdownStyle}
              placeholder="Select Destination"
              zIndex={3000}
              zIndexInverse={1000}
              nestedScrollEnabled={true} // Ensure DropDownPicker's internal list can scroll independently
            />
          )}
        </View>

        <InputField
          value={form.quantity}
          onChange={(text) => updateForm('quantity', text)}
          placeholder="Quantity"
          keyboardType="numeric"
        />

        <View style={styles.dimView}>
          {['length', 'width', 'height'].map((dim) => (
            <InputField
              key={dim}
              value={form[dim]}
              onChange={(text) => updateForm(dim, text)}
              placeholder={`${dim.charAt(0).toUpperCase() + dim.slice(1)} (cm) - Optional`}
              style={styles.dimensions}
              keyboardType="numeric"
            />
          ))}
        </View>

        <CustomButton
          title="Add Tare Weight"
          onPress={() => setDolleyVisible((prev) => !prev)}
          style={styles.button}
        />

        {dolleyVisible && (
          <>
            <InputField
              value={form.tareWeight}
              onChange={(text) => updateForm('tareWeight', text)}
              placeholder="Tare Weight 0.00 kg (Optional)"
              keyboardType="numeric"
            />
            <InputField
              value={form.pmcNumber}
              onChange={(text) => updateForm('pmcNumber', text)}
              placeholder="ULD Number (Optional)"
            />
          </>
        )}

        <Modal
          animationType="slide"
          transparent
          visible={modalVisible}
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.centeredView}>
            <View style={styles.modalView}>
              <Text style={styles.modalTitle}>Print Receipt</Text>
              <CustomButton
                title="Reconnect Printer"
                onPress={() => connectToDevice(store.getState().settings.printerAddress)}
                style={styles.modalButton}
                textStyle={styles.modalButtonText}
                icon={<AntDesign name="printer" size={24} color="blue" />}
              />
              <CustomButton
                title="Print"
                onPress={showPrinterReceipt}
                style={styles.modalButton}
              />
              <CustomButton
                title="Close"
                onPress={() => setModalVisible(false)}
                style={[styles.modalButton, styles.closeButton]}
              />
            </View>
          </View>
        </Modal>

        <View
          style={[styles.scaleDisplay, { backgroundColor: scaleData.isStable ? '#4CAF50' : '#F44336' }]}
        >
          <View style={styles.scaleData}>
            <Text style={styles.textBold}>Connected Device:</Text>
            <Text style={styles.textRegular}>{receivedData ? 'Connected' : 'Disconnected'}</Text>
            <Text style={styles.textBold}>Scale Stability:</Text>
            <Text style={styles.textRegular}>{scaleData.isStable ? 'Stable' : 'Unstable'}</Text>
          </View>
          <Text style={styles.textWeight}>{scaleData.reading || 'N/A'}</Text>
        </View>

        <CustomButton
          title={
            scaleData.isStable && scaleData.reading
              ? `Capture (${scaleData.reading})`
              : 'Waiting for stable reading...'
          }
          onPress={captureProduct}
          disabled={!scaleData.isStable}
          style={[styles.button, !scaleData.isStable && styles.buttonDisabled]}
        />

        <CustomButton
          title="Reset Scale"
          onPress={resetStability}
          style={[styles.button, styles.resetButton]}
        />

        <View style={styles.preview}>
          <Text style={styles.tableHeader}>Records</Text>
          <View style={styles.table}>
            <View style={styles.tableRow}>
              {['Item', 'Quantity', 'Weight', 'Dimensions', 'Total-Vol'].map((header) => (
                <Text key={header} style={styles.tableHeaderCell}>{header}</Text>
              ))}
            </View>
            {products.map((item, index) => (
              <ProductRow key={index} item={item} index={index} onDelete={handleDelete} />
            ))}
            <View style={styles.totalRow}>
              <Text style={styles.tableCell}>Total</Text>
              <Text style={styles.tableCell}>{calculateTotals.totalQuantity}</Text>
              <Text style={styles.tableCell}>{calculateTotals.totalWeight}kg</Text>
              <Text style={styles.tableCell}>N/A</Text>
              <Text style={styles.tableCell}>{calculateTotals.totalVolume} cm³</Text>
            </View>
          </View>
        </View>

        <CustomButton
          title="Save Record"
          onPress={saveData}
          loading={loading}
          style={[styles.button, styles.saveButton]}
        />
        <CustomButton
          title="Sync to Firebase"
          onPress={syncLocalRecordsToFirebase}
          loading={loading}
          style={[styles.button, styles.syncButton]}
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9F9F9',
  },
  innerContainer: {
    alignItems: 'center',
    padding: 16,
  },
  paymentStatusContainer: {
    backgroundColor: '#f0f0f0',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    width: '90%',
    alignItems: 'center',
  },
  paymentStatusText: {
    fontSize: 16,
    fontFamily: 'Poppins-Medium',
    color: '#333',
  },
  infoToggleButton: {
    backgroundColor: '#E0E0E0',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    width: '90%',
  },
  infoToggleText: {
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
    color: '#333',
    textAlign: 'center',
  },
  infoContainer: {
    backgroundColor: '#F2F2F2',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    width: '90%',
  },
  infoTitle: {
    fontSize: 16,
    fontFamily: 'Poppins-Bold',
    color: '#333',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#333',
    marginBottom: 4,
  },
  input: {
    padding: 12,
    width: '90%',
    marginBottom: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
    backgroundColor: '#fff',
    fontFamily: 'Poppins-Regular',
  },
  dropdownContainer: {
    width: '90%',
    marginBottom: 12,
  },
  picker: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  pickerContainer: {
    width: '100%',
  },
  dropdownStyle: {
    backgroundColor: '#fff',
    borderColor: '#ccc',
    borderRadius: 8,
  },
  dimensions: {
    flex: 1,
    marginHorizontal: 4,
  },
  dimView: {
    flexDirection: 'row',
    width: '90%',
    marginBottom: 12,
  },
  scaleDisplay: {
    width: '90%',
    height: 100,
    borderRadius: 8,
    flexDirection: 'row',
    padding: 16,
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  scaleData: {
    flex: 1,
  },
  button: {
    width: '90%',
    backgroundColor: '#2196F3',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonDisabled: {
    backgroundColor: '#B0BEC5',
  },
  buttonText: {
    fontFamily: 'Poppins-Medium',
    fontSize: 16,
    color: '#fff',
  },
  resetButton: {
    backgroundColor: '#FF5733',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
  },
  syncButton: {
    backgroundColor: '#3498db',
  },
  preview: {
    width: '90%',
    backgroundColor: '#F2F2F2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  table: {
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  tableHeader: {
    fontSize: 16,
    fontFamily: 'Poppins-Bold',
    padding: 12,
    textAlign: 'center',
  },
  tableHeaderCell: {
    flex: 1,
    padding: 12,
    backgroundColor: '#f1f1f1',
    fontFamily: 'Poppins-Bold',
    textAlign: 'center',
  },
  tableCell: {
    flex: 1,
    padding: 12,
    textAlign: 'center',
    fontFamily: 'Poppins-Regular',
  },
  totalRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderColor: '#eee',
    backgroundColor: '#f9f9f9',
  },
  textBold: {
    fontFamily: 'Poppins-Bold',
    fontSize: 14,
    color: '#fff',
  },
  textRegular: {
    fontFamily: 'Poppins-Regular',
    fontSize: 14,
    color: '#fff',
  },
  textWeight: {
    fontFamily: 'Poppins-Medium',
    fontSize: 24,
    color: '#fff',
  },
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalView: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    width: '90%',
    alignItems: 'center',
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Poppins-Bold',
    marginBottom: 16,
  },
  modalButton: {
    backgroundColor: '#2196F3',
    marginBottom: 8,
  },
  modalButtonText: {
    color: '#fff',
  },
  closeButton: {
    backgroundColor: '#FF5733',
  },
});

export default RecordPage;