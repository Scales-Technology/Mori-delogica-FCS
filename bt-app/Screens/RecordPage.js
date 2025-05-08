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
} from 'react-native';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as Network from 'expo-network';
import AntDesign from '@expo/vector-icons/AntDesign';
import { useBluetooth } from 'rn-bluetooth-classic';
import { addDoc, collection, doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../Database/config';
import { store } from '../store/store';
import { useDispatch, useSelector } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { debounce } from 'lodash';

const { width: screenWidth } = Dimensions.get('window');

const InputField = ({ value, onChange, placeholder, style, keyboardType }) => (
  <TextInput
    value={value}
    onChangeText={onChange}
    placeholder={placeholder}
    style={style}
    keyboardType={keyboardType}
  />
);

const CustomButton = ({ title, onPress, disabled, style, textStyle, loading, icon }) => (
  <TouchableOpacity
    style={[styles.button, style, disabled && { backgroundColor: '#ccc' }]}
    onPress={onPress}
    disabled={disabled}
  >
    {loading ? (
      <ActivityIndicator color="#fff" />
    ) : (
      <>
        {icon}
        <Text style={[styles.textButton, textStyle]}>{title}</Text>
      </>
    )}
  </TouchableOpacity>
);

const ProductRow = React.memo(({ item, index, onDelete }) => (
  <TouchableOpacity onPress={() => onDelete(index)} style={styles.tableRow}>
    <Text style={styles.tableCell}>{item.productType}</Text>
    <Text style={styles.tableCell}>{item.quantity}</Text>
    <Text style={styles.tableCell}>{item.weight}kg</Text>
    <Text style={styles.tableCell}>{`${item.lt}*${item.wd}*${item.ht}`}</Text>
    <Text style={styles.tableCell}>{item.tVol.toFixed(1)} cm³</Text>
  </TouchableOpacity>
));

const RecordPage = ({ route, navigation }) => {
  const { category, awbnumber, shipper, paymentInfo, senderDetails, receiverDetails } = route.params;
  const dispatch = useDispatch();
  const { BusinessId } = useSelector((state) => state.settings);

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
  const [modalVisible, setModalVisible] = useState(false);
  const [dolleyVisible, setDolleyVisible] = useState(false);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState(paymentInfo?.status || 'Unpaid');
  const [senderInfoVisible, setSenderInfoVisible] = useState(false);
  const [receiverInfoVisible, setReceiverInfoVisible] = useState(false);
  const [scaleData, setScaleData] = useState({
    reading: null,
    rawReading: null,
    isStable: false,
    lastUpdated: null,
  });

  const recentReadingsRef = useRef([]);
  const lastDataTimeRef = useRef(null);
  const isScaleActiveRef = useRef(false);

  const { connectToDevice, receivedData, writeToDevice } = useBluetooth();

  const validateNumericInput = (text) => {
    const valid = text.match(/^\d*\.?\d{0,2}$/);
    return valid ? text : '';
  };

  const updateForm = (field, value) => {
    const numericFields = ['quantity', 'length', 'width', 'height', 'tareWeight'];
    setForm((prev) => ({
      ...prev,
      [field]: numericFields.includes(field) ? validateNumericInput(value) : value,
    }));
  };

  const { totalQuantity, totalWeight, netWeight, totalVolume } = useMemo(() => {
    const totalQty = products.reduce((acc, item) => acc + parseInt(item.quantity, 10), 0);
    const totalWgt = products.reduce((acc, item) => acc + parseFloat(item.weight), 0);
    const totalVol = products.reduce((acc, item) => acc + parseFloat(item.tVol), 0);
    const netWgt = totalWgt - parseFloat(form.tareWeight || 0);
    return {
      totalQuantity: totalQty,
      totalWeight: totalWgt.toFixed(2),
      netWeight: netWgt.toFixed(2),
      totalVolume: totalVol.toFixed(1),
    };
  }, [products, form.tareWeight]);

  const checkStability = (newReading) => {
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
  };

  const parseBluetoothData = debounce((data) => {
    let numericValue = null;
    try {
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

      if (numericValue !== null && !isNaN(numericValue)) {
        const isCurrentlyStable = checkStability(numericValue);
        setScaleData({
          reading: numericValue.toFixed(2),
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
  }, 100);

  useEffect(() => {
    if (receivedData) {
      lastDataTimeRef.current = Date.now();
      isScaleActiveRef.current = true;
      parseBluetoothData(receivedData);
    }
  }, [receivedData]);

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

  const saveToFirebase = async (record) => {
    const recordsRef = collection(db, 'Records');
    await addDoc(recordsRef, record);
    ToastAndroid.show('Record saved to Firebase!', ToastAndroid.LONG);
  };

  const saveToLocalStorage = async (record) => {
    const existingRecords = await AsyncStorage.getItem('localRecords');
    const records = existingRecords ? JSON.parse(existingRecords) : [];
    records.push(record);
    await AsyncStorage.setItem('localRecords', JSON.stringify(records));
    ToastAndroid.show('Record saved locally!', ToastAndroid.LONG);
  };

  const saveData = async () => {
    if (!form.productType || !form.destination || !category) {
      alert('Please fill all required fields.');
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
              supplier: selectedSupplier || null,
              category: category || null,
              awbnumber: awbnumber || null,
              productType: form.productType || null,
              shipper: shipper || null,
              products: products.length > 0 ? products : [],
              netWeight: netWeight || '0.00',
              totalWeight: totalWeight || '0.00',
              tareWeight: form.tareWeight || '0.00',
              paymentStatus: paymentStatus || 'Unpaid',
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
            } catch (firebaseError) {
              console.error('Firebase save error:', firebaseError);
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
  };

  const syncLocalRecordsToFirebase = async () => {
    try {
      setLoading(true);
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
      let errorCount = 0;

      for (const record of localRecords) {
        try {
          const recordsRef = collection(db, 'Records');
          await addDoc(recordsRef, {
            ...record,
            syncedAt: new Date(),
            userId: auth.currentUser?.uid || null,
            businessId: BusinessId || null,
          });
          syncedCount++;
        } catch (error) {
          console.error('Error syncing record:', error);
          errorCount++;
        }
      }

      if (errorCount === 0 && syncedCount > 0) {
        await AsyncStorage.removeItem('localRecords');
        ToastAndroid.show(`Successfully synced ${syncedCount} records to Firebase!`, ToastAndroid.LONG);
      } else if (syncedCount > 0) {
        ToastAndroid.show(`Synced ${syncedCount} records. ${errorCount} failed.`, ToastAndroid.LONG);
      } else {
        ToastAndroid.show('Failed to sync records to Firebase', ToastAndroid.LONG);
      }
    } catch (error) {
      console.error('Sync error:', error);
      Alert.alert('Sync Error', `Failed to sync: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const showPrinterReceipt = async () => {
    try {
      const supplier = category || 'N/A';
      const airweighbillnumber = awbnumber || 'Unknown';
      const destinationLocation = form.destination || 'Unknown';
      const tareweight = form.tareWeight || 'N/A';
      const netweight = netWeight || 'N/A';
      const ship = shipper || 'N/A';
      const items = products || [];
      const pmcNumber = form.pmcNumber || '';
      const payment = paymentStatus || 'Unpaid';
      const sender = senderDetails?.name || 'Unknown';
      const receiver = receiverDetails?.name || 'Unknown';

      let receiptData = '';
      receiptData += '    ====== SCALESTECH =====\n\n';
      receiptData += ` Category: ${supplier.padEnd(10, ' ')}\n`;
      receiptData += ` ULD Number: ${pmcNumber.padEnd(10, ' ')}\n`;
      receiptData += ` AWB: ${airweighbillnumber.padEnd(10, ' ')}\n`;
      receiptData += ` Destination: ${destinationLocation.padEnd(10, ' ')}\n`;
      receiptData += ` Shipper: ${ship.padEnd(10, '')} \n`;
      receiptData += ` Sender: ${sender.padEnd(10, ' ')} \n`;
      receiptData += ` Receiver: ${receiver.padEnd(10, ' ')} \n`;
      receiptData += ` Payment: ${payment.padEnd(10, ' ')} \n`;
      receiptData += ` Date:${new Date().toLocaleDateString().padEnd(9, ' ')} Time:${new Date().toLocaleTimeString()}\n\n`;
      receiptData += '---------- Products ---------\n';
      receiptData += 'Item   Qty    wgt(Kg)    Dim(cm)  \n';

      let totalQuantity = 0;
      let totalWeight = 0;
      let totalVol = 0;

      items.forEach((item) => {
        const { label = item.productType || 'Unknown', quantity = 0, weight = 0, lt = 0, wd = 0, ht = 0, tVol = 0 } = item;
        const qty = parseInt(quantity, 10);
        const wgt = parseFloat(weight);
        const tvol = parseFloat(tVol);
        const dim = lt && wd && ht ? `${lt}*${wd}*${ht}` : 'N/A';

        totalQuantity += qty;
        totalWeight += wgt;
        totalVol += tvol;

        receiptData += `${label.padEnd(8, ' ')} ${qty.toString().padStart(2, ' ')} ${wgt.toFixed(2).padStart(9, ' ')} ${dim.padStart(9, ' ')}  \n`;
      });

      receiptData += '----------------------\n';
      receiptData += `GW:    ${totalQuantity.toString().padStart(4, ' ')}   ${totalWeight.toFixed(2).padStart(8, ' ')} Kg    \n\n`;
      receiptData += `Tare Weight: ${tareweight.toString().padStart(6, '')} Kg \n`;
      receiptData += `Net Weight: ${netweight.toString().padStart(6, '')} Kg \n\n\n\n`;
      receiptData += '   Thank you for your business!\n';
      receiptData += '   ===========================\n';
      receiptData += '\n\n\n';

      const printer = store.getState().settings.printerAddress;
      writeToDevice(printer, receiptData, 'ascii');
    } catch (error) {
      console.error('Error generating the receipt:', error);
    }
  };

  const handleDelete = (index) => {
    Alert.alert('Confirm Deletion', 'Are you sure you want to delete this product?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        onPress: () => {
          setProducts((prev) => prev.filter((_, i) => i !== index));
        },
        style: 'destructive',
      },
    ]);
  };

  const renderProducts = useMemo(
    () => products.map((item, index) => <ProductRow key={index} item={item} index={index} onDelete={handleDelete} />),
    [products]
  );

  const resetStability = () => {
    recentReadingsRef.current = [];
    setScaleData({
      reading: null,
      rawReading: null,
      isStable: false,
      lastUpdated: null,
    });
    ToastAndroid.show('Scale reset successfully', ToastAndroid.SHORT);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#F9F9F9' }}>
      <View style={styles.container}>
        <View style={styles.paymentStatusContainer}>
          <Text style={styles.paymentStatusText}>Payment Status: {paymentStatus}</Text>
        </View>

        <CustomButton
          title={senderInfoVisible ? 'Hide Sender Info' : 'Show Sender Info'}
          onPress={() => setSenderInfoVisible((prev) => !prev)}
          style={styles.infoToggleButton}
          textStyle={styles.infoToggleText}
        />
        {senderInfoVisible && (
          <View style={styles.infoContainer}>
            <Text style={styles.infoTitle}>Sender Information</Text>
            <Text style={styles.infoText}>Name: {senderDetails?.name || 'N/A'}</Text>
            <Text style={styles.infoText}>Phone: {senderDetails?.phone || 'N/A'}</Text>
            <Text style={styles.infoText}>ID Number: {senderDetails?.idNumber || 'N/A'}</Text>
            <Text style={styles.infoText}>Staff: {senderDetails?.staffName || 'N/A'}</Text>
          </View>
        )}

        <CustomButton
          title={receiverInfoVisible ? 'Hide Receiver Info' : 'Show Receiver Info'}
          onPress={() => setReceiverInfoVisible((prev) => !prev)}
          style={styles.infoToggleButton}
          textStyle={styles.infoToggleText}
        />
        {receiverInfoVisible && (
          <View style={styles.infoContainer}>
            <Text style={styles.infoTitle}>Receiver Information</Text>
            <Text style={styles.infoText}>Name: {receiverDetails?.name || 'N/A'}</Text>
            <Text style={styles.infoText}>Phone: {receiverDetails?.phone || 'N/A'}</Text>
            <Text style={styles.infoText}>ID Number: {receiverDetails?.idNumber || 'N/A'}</Text>
          </View>
        )}

        <InputField
          value={form.productType}
          onChange={(text) => updateForm('productType', text)}
          placeholder="Product Type"
          style={styles.supplier}
        />
        <InputField
          value={form.destination}
          onChange={(text) => updateForm('destination', text)}
          placeholder="Destination"
          style={styles.supplier}
        />
        <InputField
          value={form.quantity}
          onChange={(text) => updateForm('quantity', text)}
          placeholder="Quantity"
          style={styles.supplier}
          keyboardType="numeric"
        />
        <View style={styles.dimView}>
          <InputField
            value={form.length}
            onChange={(text) => updateForm('length', text)}
            placeholder="Length (cm)"
            style={styles.dimensions}
            keyboardType="numeric"
          />
          <InputField
            value={form.width}
            onChange={(text) => updateForm('width', text)}
            placeholder="Width (cm)"
            style={styles.dimensions}
            keyboardType="numeric"
          />
          <InputField
            value={form.height}
            onChange={(text) => updateForm('height', text)}
            placeholder="Height (cm)"
            style={styles.dimensions}
            keyboardType="numeric"
          />
        </View>
        <CustomButton
          title="Add Tare Weight"
          onPress={() => setDolleyVisible(true)}
          style={styles.button}
        />
        {dolleyVisible && (
          <>
            <InputField
              value={form.tareWeight}
              onChange={(text) => updateForm('tareWeight', text)}
              placeholder="Tare Weight 0.00 kg (Optional)"
              style={styles.supplier}
              keyboardType="numeric"
            />
            <InputField
              value={form.pmcNumber}
              onChange={(text) => updateForm('pmcNumber', text)}
              placeholder="ULD Number (Optional)"
              style={styles.supplier}
            />
          </>
        )}

        {modalVisible && (
          <Modal
            animationType="slide"
            transparent={true}
            visible={modalVisible}
            onRequestClose={() => setModalVisible(false)}
          >
            <View style={styles.centeredView}>
              <View style={styles.modalView}>
                <View style={styles.modalNav}>
                  <Text style={styles.touchableText}>Print Receipt</Text>
                </View>
                <View style={styles.modalContent}>
                  <CustomButton
                    title="Reconnect Printer"
                    onPress={() => connectToDevice(store.getState().settings.printerAddress)}
                    style={{ borderRadius: 20 }}
                    textStyle={{ color: 'blue' }}
                    icon={<AntDesign name="printer" size={34} color="blue" />}
                  />
                  <CustomButton title="Print" onPress={showPrinterReceipt} />
                </View>
              </View>
            </View>
          </Modal>
        )}

        <View
          style={[styles.display, { backgroundColor: scaleData.isStable ? 'green' : 'red' }]}
        >
          <View style={styles.data}>
            <Text style={styles.textBold}>Connected Device:</Text>
            <Text style={styles.textRegular}>{receivedData ? 'Connected' : 'Disconnected'}</Text>
            <Text style={styles.textBold}>Scale Stability:</Text>
            <Text style={styles.textRegular}>{scaleData.isStable ? 'Stable' : 'Unstable'}</Text>
          </View>
          <Text style={styles.textWeight}>{scaleData.reading}</Text>
        </View>

        <CustomButton
          title={
            scaleData.isStable && scaleData.reading
              ? `Capture (${scaleData.reading}kg)`
              : 'Waiting for stable reading...'
          }
          onPress={() => {
            if (!scaleData.isStable) {
              ToastAndroid.show('Please wait for scale to stabilize', ToastAndroid.SHORT);
              return;
            }
            Alert.alert(
              'Confirm Capture',
              `Are you sure you want to capture this product?\nWeight: ${scaleData.reading}kg`,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'OK',
                  onPress: () => {
                    const totalvolume = form.height * form.width * form.length * form.quantity;
                    const airlineCalc = totalvolume / 1;
                    if (scaleData.reading) {
                      setProducts((prevProducts) => [
                        ...prevProducts,
                        {
                          ...form.productType,
                          quantity: form.quantity,
                          weight: scaleData.rawReading,
                          productType: form.productType,
                          tVol: airlineCalc,
                          ht: form.height,
                          wd: form.width,
                          lt: form.length,
                        },
                      ]);
                      ToastAndroid.show('Product captured successfully!', ToastAndroid.SHORT);
                      setForm({
                        productType: '',
                        destination: form.destination,
                        quantity: '',
                        length: '',
                        width: '',
                        height: '',
                        tareWeight: form.tareWeight,
                        pmcNumber: form.pmcNumber,
                      });
                    } else {
                      ToastAndroid.show('No valid weight reading', ToastAndroid.SHORT);
                    }
                  },
                },
              ]
            );
          }}
          disabled={!scaleData.isStable}
          style={{ backgroundColor: scaleData.isStable ? '#4CAF50' : '#CCCCCC' }}
          textStyle={{ color: scaleData.isStable ? '#FFFFFF' : '#999999' }}
        />

<CustomButton
    title="Reset Scale"
    onPress={resetStability}
    style={{ backgroundColor: '#FF5733' }}
    textStyle={{ color: '#fff' }}
  />

        <View style={styles.preview}>
          <ScrollView style={styles.scroll}>
            <View style={styles.table}>
              <Text style={styles.tableHeader}>Records</Text>
              <View style={styles.tableRow}>
                <Text style={styles.tableHeader}>Item</Text>
                <Text style={styles.tableHeader}>Quantity</Text>
                <Text style={styles.tableHeader}>Weight</Text>
                <Text style={styles.tableHeader}>Dimensions</Text>
                <Text style={styles.tableHeader}>Total-Vol</Text>
              </View>
              {renderProducts}
              <View style={styles.totalRow}>
                <Text style={styles.tableCell}>Total</Text>
                <Text style={styles.tableCell}>{totalQuantity}</Text>
                <Text style={styles.tableCell}>{totalWeight}kg</Text>
                <Text style={styles.tableCell}>N/A</Text>
                <Text style={styles.tableCell}>{totalVolume} cm³</Text>
              </View>
            </View>
          </ScrollView>
        </View>

        <CustomButton
          title="Save Record"
          onPress={saveData}
          loading={loading}
          style={{ backgroundColor: 'green' }}
          textStyle={{ color: '#fff' }}
        />
        <CustomButton
          title="Sync to Firebase"
          onPress={syncLocalRecordsToFirebase}
          loading={loading}
          style={{ backgroundColor: '#3498db' }}
          textStyle={{ color: '#fff' }}
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 10,
    backgroundColor: '#F9F9F9',
  },
  paymentStatusContainer: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 15,
    width: screenWidth * 0.8,
    alignItems: 'center',
  },
  paymentStatusText: {
    fontSize: 16,
    fontFamily: 'Poppins-Medium',
    color: '#333',
  },
  infoToggleButton: {
    backgroundColor: '#E0E0E0',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 10,
    width: screenWidth * 0.8,
    alignItems: 'center',
  },
  infoToggleText: {
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
    color: '#333',
  },
  infoContainer: {
    backgroundColor: '#F2F2F2',
    padding: 16,
    borderRadius: 10,
    marginBottom: 15,
    width: screenWidth * 0.8,
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
  display: {
    height: 100,
    width: screenWidth * 0.9,
    borderRadius: 10,
    flexDirection: 'row',
    padding: 10,
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  data: {
    flex: 1,
  },
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 22,
  },
  supplier: {
    padding: 10,
    width: screenWidth * 0.8,
    marginBottom: 5,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'grey',
  },
  dimensions: {
    padding: 10,
    width: screenWidth * 0.2,
    margin: 5,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'grey',
  },
  dimView: {
    flexDirection: 'row',
  },
  modalView: {
    margin: 20,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 35,
    width: screenWidth * 0.9,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  button: {
    width: screenWidth * 0.9,
    backgroundColor: '#F2F2F2',
    paddingVertical: 12,
    alignItems: 'center',
    margin: 10,
    borderRadius: 50,
  },
  textButton: {
    fontFamily: 'Poppins-Regular',
    fontSize: 16,
  },
  preview: {
    height: 'auto',
    backgroundColor: '#F2F2F2',
    borderRadius: 10,
    flex: 1,
    width: screenWidth * 0.9,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 5,
    marginVertical: 10,
  },
  scroll: {
    backgroundColor: 'white',
    width: '100%',
    borderRadius: 10,
  },
  table: {
    width: '100%',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#ddd',
  },
  tableHeader: {
    flex: 1,
    padding: 10,
    backgroundColor: '#f1f1f1',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  tableCell: {
    flex: 1,
    padding: 10,
    textAlign: 'center',
  },
  totalRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#f9f9f9',
  },
  textBold: {
    fontFamily: 'Poppins-Bold',
    fontSize: 14,
    color: 'white',
  },
  textRegular: {
    fontFamily: 'Poppins-Regular',
    fontSize: 14,
    color: 'white',
  },
  textWeight: {
    fontFamily: 'Poppins-Regular',
    fontSize: 24,
    color: 'white',
  },
  modalNav: {
    width: '100%',
    alignItems: 'center',
  },
  touchableText: {
    fontSize: 18,
    fontFamily: 'Poppins-Bold',
  },
  modalContent: {
    width: '100%',
    alignItems: 'center',
  },
});

export default RecordPage;