import * as Network from "expo-network";
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
} from "react-native";
import React, { useState, useEffect, useRef, useMemo } from "react";
import DropdownComponent from "../Components/DropDown";
import Header from "../Components/Header";
import AntDesign from "@expo/vector-icons/AntDesign";
import { useBluetooth } from "rn-bluetooth-classic";
import { addDoc, collection, doc, getDoc, getDocs } from "firebase/firestore";
import { auth, db } from "../Database/config";
import { store } from "../store/store";
import { useDispatch, useSelector } from "react-redux";
import { setSuppliers, setCollections, setLocations } from "../store";
import {
  BottomSheetModal,
  BottomSheetModalProvider,
} from "@gorhom/bottom-sheet";
import RNBluetooth from "react-native-bluetooth-classic";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");
import data from "../store/dummyData"; 
import AsyncStorage from '@react-native-async-storage/async-storage';

const RecordPage = ({ route, navigation }) => {
  const {category, awbnumber, shipper, paymentInfo, senderDetails, receiverDetails } = route.params;
  const dispatch = useDispatch();
  const collections = useSelector((state) => state.settings.collections);
  const suppliers = useSelector((state) => state.settings.suppliers);
  const { BusinessId, user } = useSelector((state) => state.settings);

  const [selectedProductType, setSelectedProductType] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [connectedDevice, setConnectedDevice] = useState(null);
  const [scaleStability, setScaleStability] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [destination, setDestination] = useState(null);
  const [pquantity, setQuantity] = useState(null);
  const [netWeight, setNetWeight] = useState(false);
  const [totalQuantity, setTotalQuantity] = useState(0);
  const [totalWeight, setTotalWeight] = useState(0);
  const [tareWeight, setTareWeight] = useState(0);
  const [appData] = useState(data);
  const [dolleyCategories, setDolleyCategories] = useState([]);
  const[dolleyvisible, setDolleyVisible] = useState(false);
  const [length, setLength] = useState(null);
  const [width, setWidth] = useState(null);
  const [height, setHeight] = useState(null);
  const [totalVolume, setTotalVolume] = useState(null);
  const [pmcnumber, setPmcNumber] = useState(null);
  const [userDetails, setUserDetails] = useState(null);
  // Extract payment status from the navigation params
  const [paymentStatus, setPaymentStatus] = useState(paymentInfo?.status || "Unpaid");
  const [senderInfoVisible, setSenderInfoVisible] = useState(false);
  const [receiverInfoVisible, setReceiverInfoVisible] = useState(false);
  
  // NEW: Ref for recent readings to help with stability detection
  const recentReadingsRef = useRef([]);

  const bottomSheetModalRef = useRef(null);

  useEffect(() => {
    const fetchUserDetails = async () => {
      try {
        const userId = auth.currentUser.uid;
        const userDocRef = doc(db, 'User', userId);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          setUserDetails(userDoc.data());
          console.log(userDetails)
        } else {
          console.log('User does not exist in Firestore');
        }
      } catch (error) {
        console.error('Error fetching user details: ', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserDetails();
  }, []);


  useEffect(() => {
    const fetchDolleyCategories = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'DolleyCategory'));
        const categories = [];
        querySnapshot.forEach((doc) => {
          categories.push({ id: doc.id, ...doc.data() });
        });
        setDolleyCategories(categories);
      } catch (error) {
        console.error("Error fetching dolley categories: ", error);
      }
    };

    fetchDolleyCategories();
  }, []);

  const addtareWeight = ()=>{
    setDolleyVisible(true);
  }

  const toggleSenderInfo = () => {
    setSenderInfoVisible(!senderInfoVisible);
  }

  const toggleReceiverInfo = () => {
    setReceiverInfoVisible(!receiverInfoVisible);
  }

  const {
    devices,
    connectToDevice,
    receivedData,
    isConnected,
    disconnectDevice,
    writeToDevice,
    readFromDevice,
  } = useBluetooth();

  // Improved scale data state
const [scaleData, setScaleData] = useState({
  reading: null,
  rawReading: null,
  isStable: false,
  lastUpdated: null
});


// const recentReadingsRef = useRef([]);

const lastDataTimeRef = useRef(null);

const isScaleActiveRef = useRef(false);

useEffect(() => {
  if (receivedData) {
    const parsedData = parseBluetoothData(receivedData);
    
    // Update the last time we received data
    lastDataTimeRef.current = Date.now();
    
    // If we're receiving data, mark the scale as active
    isScaleActiveRef.current = true;
    
    if (parsedData && parsedData.reading !== null) {
      setScaleData({
        ...parsedData,
        lastUpdated: Date.now()
      });
      console.log("PARSED", parsedData);
    }
  }
}, [receivedData]);

// scale inactivity
useEffect(() => {
  const inactivityTimer = setInterval(() => {
    // If we haven't received data in 5 seconds (increased from 3), consider the scale inactive
    if (lastDataTimeRef.current && Date.now() - lastDataTimeRef.current > 5000) {
      isScaleActiveRef.current = false;
      
      // Clear the recent readings if the scale is inactive
      recentReadingsRef.current = [];
      
      // Update scale state to show it's not stable when inactive
      setScaleData(prev => ({
        ...prev,
        isStable: false
      }));
    }
  }, 1000);
  
  return () => clearInterval(inactivityTimer);
}, []);

useEffect(() => {
  const newTotalQuantity = products.reduce(
    (acc, item) => acc + parseInt(item.quantity),
    0
  );
  const newTotalWeight = products.reduce(
    (acc, item) => acc + parseFloat(item.weight),
    0
  );
  const newTotalVolume = products.reduce(
    (acc, item) => acc + parseFloat(item.tVol),
    0
  );
  
  const newNetWeight = newTotalWeight - parseFloat(tareWeight);
  setTotalQuantity(newTotalQuantity);
  setTotalWeight(newTotalWeight.toFixed(2));
  setNetWeight(newNetWeight.toFixed(2));
  setTotalVolume(newTotalVolume.toFixed(1));
}, [products]);

/// Modified checkStability function for longer stability detection
const checkStability = (newReading) => {
  const isZeroReading = Math.abs(newReading) < 0.01;
  
  // Add the new reading to our recent readings array
  recentReadingsRef.current.push(newReading);
  
  // Keep only the most recent 5 readings
  if (recentReadingsRef.current.length > 5) {
    recentReadingsRef.current.shift();
  }
  
  // Need at least 2 readings and scale must be active to check stability
  if (recentReadingsRef.current.length >= 2 && isScaleActiveRef.current) {
    const recentValues = recentReadingsRef.current.slice(-3);
    
    // Find min and max values
    const min = Math.min(...recentValues);
    const max = Math.max(...recentValues);
    
    // Calculate difference and determine stability
    // Adjust this threshold based on your scale's precision
    const threshold = 0.1; 
    
    // Don't consider zero readings as stable unless explicitly needed
    if (isZeroReading && recentValues.every(v => Math.abs(v) < 0.01)) {
      console.log("Zero reading detected - not considering as stable");
      return false;
    }
    
    const isCurrentlyStable = (max - min) <= threshold;
    
    console.log(
      "Stability check:", 
      "Recent readings:", recentValues, 
      "Min:", min, 
      "Max:", max, 
      "Difference:", (max - min), 
      "Scale active:", isScaleActiveRef.current,
      "Stable:", isCurrentlyStable
    );
    
    // IMPORTANT CHANGE: If we have more than 3 recent readings and they're all very close,
    // keep the stable status even if there are minor fluctuations
    if (recentReadingsRef.current.length >= 3) {
      const allReadings = [...recentReadingsRef.current];
      const minAll = Math.min(...allReadings);
      const maxAll = Math.max(...allReadings);
      
      // If all readings are within a slightly wider threshold, maintain stability
      const maintainThreshold = 0.2; // Slightly more forgiving threshold to maintain stability
      if ((maxAll - minAll) <= maintainThreshold) {
        return true;
      }
    }
    
    return isCurrentlyStable;
  }
  
  return false; 
};

// Modified useEffect for scale data to maintain stability longer
useEffect(() => {
  if (receivedData) {
    const parsedData = parseBluetoothData(receivedData);
    
    // Update the last time we received data
    lastDataTimeRef.current = Date.now();
    
    // If we're receiving data, mark the scale as active
    isScaleActiveRef.current = true;
    
    if (parsedData && parsedData.reading !== null) {
      // IMPORTANT CHANGE: If we already have stable readings and the new reading is very close
      // to the previous one, maintain the stable status
      if (scaleData.isStable && scaleData.rawReading !== null) {
        const difference = Math.abs(parsedData.rawReading - scaleData.rawReading);
        const stabilityThreshold = 0.15; // Threshold to maintain stability
        
        if (difference <= stabilityThreshold) {
          // Maintain stability but update the reading
          setScaleData({
            reading: parsedData.reading,
            rawReading: parsedData.rawReading,
            isStable: true,
            lastUpdated: Date.now()
          });
          console.log("Maintaining stability, difference:", difference);
          return;
        }
      }
      
      // Otherwise, use the normal stability check
      setScaleData({
        ...parsedData,
        lastUpdated: Date.now()
      });
      console.log("PARSED", parsedData);
    }
  }
}, [receivedData]);

// Improved Bluetooth data parser
const parseBluetoothData = (data) => {
  console.log("Received data:", data);
  let numericValue = null;

  if (typeof data === 'string') {
    try {
      // Try base64 decoding first
      const decodedData = atob(data);
      const match = decodedData.match(/-?\d+(\.\d+)?/);
      if (match) {
        numericValue = parseFloat(match[0]);
      }
    } catch (error) {
      console.log("Not base64 encoded, trying direct extraction");
      const match = data.match(/-?\d+(\.\d+)?/);
      if (match) {
        console.log("Extracted value:", match[0]);
        numericValue = parseFloat(match[0]);
      }
    }
  } else if (typeof data === 'number') {
    console.log("Numeric data received:", data);
    numericValue = data;
  } else if (data && typeof data === 'object') {
    console.log("Object data received, attempting to extract value");
    const dataString = data.toString ? data.toString() : JSON.stringify(data);
    const match = dataString.match(/-?\d+(\.\d+)?/);
    if (match) {
      console.log("Extracted value from object:", match[0]);
      numericValue = parseFloat(match[0]);
    }
  }

  console.log("Processed numeric value:", numericValue);

  if (numericValue !== null && !isNaN(numericValue)) {
    // Check stability using the improved method
    const isCurrentlyStable = checkStability(numericValue);
    
    return {
      reading: numericValue.toFixed(2),
      rawReading: numericValue,
      isStable: isCurrentlyStable
    };
  }

  return {
    reading: null,
    rawReading: null,
    isStable: false
  };
};
  const handleSwitchBt = async () => {
    const printer = store.getState().settings.printerAddress;
    connectToDevice(printer);
    console.log("Printer: ", printer);
  };

  // Improved saveData function with undefined value handling
  const saveData = async () => {
    console.log("test", category);

    if (category && destination && selectedProductType) {
      Alert.alert(
        "Confirm Save",
        "Are you sure you want to save this record?",
        [
          {
            text: "Cancel",
            onPress: () => console.log("Save canceled"),
            style: "cancel"
          },
          {
            text: "Save",
            onPress: async () => {
              setLoading(true);
              try {
                // Create record object with null for undefined values
                const record = {
                  supplier: selectedSupplier || null,
                  category: category || null,
                  awbnumber: awbnumber || null,
                  productType: selectedProductType || null,
                  shipper: shipper || null,
                  products: products.length > 0 ? products : [],
                  netWeight: netWeight || "0.00",
                  totalWeight: totalWeight || "0.00",
                  tareWeight: tareWeight || "0.00",
                  paymentStatus: paymentStatus || "Unpaid",
                  senderDetails: senderDetails || null,
                  receiverDetails: receiverDetails || null,
                  createdAt: new Date(),
                  userId: auth.currentUser?.uid || null,
                  businessId: BusinessId || null
                };

                // Clean the record object to remove any undefined values
                const cleanRecord = Object.fromEntries(
                  Object.entries(record).map(([key, value]) => 
                    [key, value === undefined ? null : value]
                  )
                );

                console.log("Saving record:", cleanRecord);
                
                try {
                  // Try to save to Firebase first (if online)
                  const recordsRef = collection(db, "Records");
                  await addDoc(recordsRef, cleanRecord);
                  
                  // Also save locally as backup
                  const existingRecords = await AsyncStorage.getItem('localRecords');
                  const records = existingRecords ? JSON.parse(existingRecords) : [];
                  records.push(cleanRecord);
                  await AsyncStorage.setItem('localRecords', JSON.stringify(records));
                  
                  ToastAndroid.show("Record saved to Firebase!", ToastAndroid.LONG);
                  setModalVisible(true);
                } catch (firebaseError) {
                  // If Firebase save fails, save locally and offer sync option
                  console.error("Firebase save error:", firebaseError);
                  
                  // Save locally
                  const existingRecords = await AsyncStorage.getItem('localRecords');
                  const records = existingRecords ? JSON.parse(existingRecords) : [];
                  records.push(cleanRecord);
                  await AsyncStorage.setItem('localRecords', JSON.stringify(records));
                  
                  ToastAndroid.show("Record saved locally!", ToastAndroid.LONG);
                  setModalVisible(true);
                  
                  // Ask user if they want to sync now
                  setTimeout(() => {
                    Alert.alert(
                      "Record Saved Locally",
                      "Would you like to sync this record to Firebase now?",
                      [
                        {
                          text: "Later",
                          style: "cancel"
                        },
                        {
                          text: "Sync Now",
                          onPress: syncLocalRecordsToFirebase
                        }
                      ]
                    );
                  }, 1000); // Small delay to ensure Toast is visible first
                }
              } catch (error) {
                console.error("Error saving record:", error);
                Alert.alert(
                  "Error",
                  `Failed to save: ${error.message}`,
                  [{ text: "OK" }]
                );
              } finally {
                setLoading(false);
              }
            }
          }
        ],
        { cancelable: false }
      );
    } else {
      alert("Please select all fields before saving.");
    }
  };
  // sync local records with Firebase

  const syncLocalRecordsToFirebase = async () => {
    try {
      setLoading(true);
      
      // Check for internet connectivity
      const networkState = await Network.getNetworkStateAsync();
      if (!networkState.isConnected || !networkState.isInternetReachable) {
        Alert.alert("No Internet", "Please connect to the internet to sync records.");
        setLoading(false);
        return;
      }

      // Get local records
      const localRecordsJson = await AsyncStorage.getItem('localRecords');
      if (!localRecordsJson) {
        ToastAndroid.show("No local records to sync", ToastAndroid.SHORT);
        setLoading(false);
        return;
      }

      const localRecords = JSON.parse(localRecordsJson);
      
      // Count of successfully synced records
      let syncedCount = 0;
      let errorCount = 0;
      
      // Process each local record
      for (const record of localRecords) {
        // Clean the record to ensure no undefined values
        const cleanRecord = Object.fromEntries(
          Object.entries(record).map(([key, value]) => 
            [key, value === undefined ? null : value]
          )
        );
        
        try {
          // Add to Firebase
          const recordsRef = collection(db, "Records");
          await addDoc(recordsRef, {
            ...cleanRecord,
            syncedAt: new Date(),
            userId: auth.currentUser?.uid || null,
            businessId: BusinessId || null
          });
          
          syncedCount++;
        } catch (error) {
          console.error("Error syncing record:", error);
          errorCount++;
        }
      }
      
      // If all records were synced successfully, clear local storage
      if (errorCount === 0 && syncedCount > 0) {
        await AsyncStorage.removeItem('localRecords');
        ToastAndroid.show(`Successfully synced ${syncedCount} records to Firebase!`, ToastAndroid.LONG);
      } else if (syncedCount > 0) {
        // Some records were synced, but not all
        ToastAndroid.show(`Synced ${syncedCount} records. ${errorCount} failed.`, ToastAndroid.LONG);
      } else {
        // No records were synced
        ToastAndroid.show("Failed to sync records to Firebase", ToastAndroid.LONG);
      }
    } catch (error) {
      console.error("Sync error:", error);
      Alert.alert("Sync Error", `Failed to sync: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const showPrinterReceipt = async () => {
    console.log("DDATA:",selectedSupplier);
    try {
        // Ensure these variables are defined
        const supplier = category || "N/A";
        const airweighbillnumber = awbnumber || "Unknown";
        const destinationLocation = destination || "Unknown";
        const tareweight = tareWeight || "N/A";
        const netweight = netWeight || "N/A";
        const ship = shipper || "N/A";
        const items = products || [];
        const separator = "----------------------\n";
        const pmcNumber = pmcnumber || "";
        const payment = paymentStatus || "Unpaid";
        const sender = senderDetails?.name || "Unknown";
        const receiver = receiverDetails?.name || "Unknown";
        // const userDt = userDetails.Name || "Unknown"

        // Initialize receipt data
        let receiptData = "";
        receiptData += "    ====== SCALESTECH =====\n\n";
        receiptData += ` Category: ${supplier.padEnd(10, ' ')}\n`;
        receiptData += ` ULD Number: ${pmcNumber.padEnd(10, ' ')}\n`;
        receiptData += ` AWB: ${airweighbillnumber.padEnd(10, ' ')}\n`;
        receiptData += ` Destination: ${destinationLocation.padEnd(10, ' ')}\n`;
        receiptData += ` Shipper: ${ship.padEnd(10, '' )} \n`;
        receiptData += ` Sender: ${sender.padEnd(10, ' ')} \n`;
        receiptData += ` Receiver: ${receiver.padEnd(10, ' ')} \n`;
        receiptData += ` Payment: ${payment.padEnd(10, ' ')} \n`;
        // receiptData += `  Printed by: ${userDt.padEnd(10, ' ')}\n`;
        receiptData += ` Date:${new Date().toLocaleDateString().padEnd(9, ' ')} Time:${new Date().toLocaleTimeString()}\n\n`;

        receiptData += "---------- Products ---------\n";
        receiptData += "Item   Qty    wgt(Kg)    Dim(cm)  \n";
        
        let totalQuantity = 0;
        let totalWeight = 0;
        let totalPrice = 0;
        let totalVol = 0;

        items.forEach((item) => {
            const { label = item.productType || "Unknown", quantity = 0, weight = 0, price = 0, lt = 0, wd =0, ht=0, tVol= 0 } = item;
            // const pName = productName;
            const qty = parseInt(quantity, 10);
            const wgt = parseFloat(weight);
            const prc = parseFloat(price);
            const tvol = parseFloat(tVol);
            const dim = lt && wd && ht ? `${lt}*${wd}*${ht}` : 'N/A';

            totalQuantity += qty;
            totalWeight += wgt;
            totalPrice += prc;
            totalVol += tvol;

            receiptData += `${label.padEnd(8, ' ')} ${qty.toString().padStart(2, ' ')} ${wgt.toFixed(2).padStart(9, ' ')} ${dim.padStart(9, ' ')}  \n`;
        });

        receiptData += separator;
        // receiptData += `GW:    ${totalQuantity.toString().padStart(4, ' ')}   ${totalWeight.toFixed(2).padStart(8, ' ')} Kg    ${totalVol.toFixed(2).padStart(12, ' ')} cm3  \n\n`;
        receiptData += `GW:    ${totalQuantity.toString().padStart(4, ' ')}   ${totalWeight.toFixed(2).padStart(8, ' ')} Kg    \n\n`;
        receiptData += `Tare Weight: ${tareweight.toString().padStart(6, '') } Kg \n`;
        receiptData += `Net Weight: ${netweight.toString().padStart(6, '')} Kg \n\n\n\n`;
        receiptData += "   Thank you for your business!\n";
        receiptData += "   ===========================\n";
        receiptData += "\n\n\n"; // Extra lines for printer feed

        console.log(receiptData); // For debugging

        const printer = store.getState().settings.printerAddress;
        writeToDevice(printer, receiptData, "ascii");
        console.log("Receipt sent to the printer");
        //navigation.navigate("HomePage")
    } catch (error) {
        console.error("Error generating the receipt:", error);
    }
  };

  const handleChange = (text) => {
    // Regex to match numbers with up to two decimal places
    const validNumber = text.match(/^\d*\.?\d{0,2}$/);
    if (validNumber) {
      setSelectedSupplier(text);
    }
  };

  const handleDelete = (index) => {
    Alert.alert(
        'Confirm Deletion',
        'Are you sure you want to delete this product?',
        [
            {
                text: 'Cancel',
                style: 'cancel',
            },
            {
                text: 'Delete',
                onPress: () => {
                    const updatedProducts = products.filter((_, i) => i !== index);
                    setProducts(updatedProducts);
                },
                style: 'destructive',
            },
        ],
        { cancelable: true }
    );
  };

  // NEW: Reset stability function to clear readings when needed
  const resetStability = () => {
    recentReadingsRef.current = [];
    setScaleData({
      reading: null,
      rawReading: null,
      isStable: false
    });
  };


return (
  <ScrollView style={{ flex: 1, backgroundColor: "#F9F9F9" }}>
    <View style={styles.container}>
     
      {/* Display payment status */}
      <View style={styles.paymentStatusContainer}>
        <Text style={styles.paymentStatusText}>Payment Status: {paymentStatus}</Text>
      </View>

      {/* Sender Info Toggle Button */}
      <TouchableOpacity 
        style={styles.infoToggleButton} 
        onPress={toggleSenderInfo}
      >
        <Text style={styles.infoToggleText}>
          {senderInfoVisible ? "Hide Sender Info" : "Show Sender Info"}
        </Text>
      </TouchableOpacity>

      {/* Sender Info Display */}
      {senderInfoVisible && (
        <View style={styles.infoContainer}>
          <Text style={styles.infoTitle}>Sender Information</Text>
          <Text style={styles.infoText}>Name: {senderDetails?.name || "N/A"}</Text>
          <Text style={styles.infoText}>Phone: {senderDetails?.phone || "N/A"}</Text>
          <Text style={styles.infoText}>ID Number: {senderDetails?.idNumber || "N/A"}</Text>
          <Text style={styles.infoText}>Staff: {senderDetails?.staffName || "N/A"}</Text>
        </View>
      )}

      {/* Receiver Info Toggle Button */}
      <TouchableOpacity 
        style={styles.infoToggleButton} 
        onPress={toggleReceiverInfo}
      >
        <Text style={styles.infoToggleText}>
          {receiverInfoVisible ? "Hide Receiver Info" : "Show Receiver Info"}
        </Text>
      </TouchableOpacity>

      {/* Receiver Info Display */}
      {receiverInfoVisible && (
        <View style={styles.infoContainer}>
          <Text style={styles.infoTitle}>Receiver Information</Text>
          <Text style={styles.infoText}>Name: {receiverDetails?.name || "N/A"}</Text>
          <Text style={styles.infoText}>Phone: {receiverDetails?.phone || "N/A"}</Text>
          <Text style={styles.infoText}>ID Number: {receiverDetails?.idNumber || "N/A"}</Text>
        </View>
      )}

      <TextInput
        value={selectedProductType}
        onChangeText={(text) => setSelectedProductType(text)}
        placeholder="Product Type"
        style={styles.supplier}
      />
      <TextInput
        value={destination}
        onChangeText={(text) => setDestination(text)}
        placeholder="Destination"
        style={styles.supplier}
      />
      <TextInput
        value={pquantity}
        onChangeText={(text) => setQuantity(text)}
        placeholder="Quantity"
        style={styles.supplier}
      />
      <View style={styles.dimView}>
      <TextInput
        value={length}
        onChangeText={(text) => setLength(text)}
        placeholder="Length (cm)"
        style={styles.dimensions}
        keyboardType="numeric"
      />
      <TextInput
        value={width}
        onChangeText={(text) => setWidth(text)}
        placeholder="Width (cm)"
        style={styles.dimensions}
        keyboardType="numeric"
      />
      <TextInput
        value={height}
        onChangeText={(text) => setHeight(text)}
        placeholder="Height (cm)"
        style={styles.dimensions}
        keyboardType="numeric"
      />
      </View>
      <TouchableOpacity
      style={styles.button}
      onPress={addtareWeight}
      >
        <Text style={styles.textButton}>Add Tare Weight</Text>
      </TouchableOpacity>
      {dolleyvisible &&
      <>
      <TextInput
      value={tareWeight}
      onChangeText={(text) => setTareWeight(text)}
      placeholder="Tare Weight 0.00 kg (Optional)"
      style={styles.supplier}
      keyboardType="numeric"
    />
    <TextInput
        value={pmcnumber}
        onChangeText={(text) => setPmcNumber(text)}
        placeholder="ULD Number  (Optional)"
        style={styles.supplier}
      />
      </>
      }
      
       {/* <TextInput
        value={selectedSupplier}
        onChangeText={handleChange}
        placeholder="Tare Weight (0.00) kg"
        style={styles.supplier}
        keyboardType="numeric" // Optional: Brings up numeric keyboard on mobile
      /> */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.centeredView}>
          <View style={styles.modalView}>
            <View style={styles.modalNav}>
              <View style={styles.modaltouchable}>
                <Text style={styles.touchableText}>Print Receipt</Text>
              </View>
            </View>
            <View style={styles.modalContent}>
              <TouchableOpacity
                style={[, styles.button, { borderRadius: 20 }]}
                onPress={handleSwitchBt}
              >
                <AntDesign name="printer" size={34} color="blue" />
                <Text style={styles.textButton}>Reconnect printer</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.button}
                onPress={showPrinterReceipt}
              >
                <Text style={styles.textButton}>Print</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

          <View
            style={[
              styles.display,
              {
                backgroundColor: scaleData.isStable ? "green" : "red",
              },
            ]}
          >
            <View style={styles.data}>
              <Text style={styles.textBold}>Connected Device:</Text>
              <Text style={styles.textRegular}>
                {receivedData ? "Connected" : "Disconnected"}
              </Text>
              <Text style={styles.textBold}>Scale Stability:</Text>
              <Text style={styles.textRegular}>
                {scaleData.isStable ? "Stable" : "Unstable"}
              </Text>
            </View>
            <View>
              <Text style={styles.textWeight}>
                {scaleData.reading }
              </Text>
            </View>
          </View>
          <TouchableOpacity
  style={[
    styles.button, 
    { 
      backgroundColor: scaleData.isStable ? "#4CAF50" : "#CCCCCC", 
      opacity: scaleData.isStable ? 1 : 0.5 
    }
  ]}
  onPress={() => {
    if (!scaleData.isStable) {
      ToastAndroid.show("Please wait for scale to stabilize", ToastAndroid.SHORT);
      return;
    }
    
    Alert.alert(
      "Confirm Capture",
      `Are you sure you want to capture this product?\nWeight: ${scaleData.reading}kg`,
      [
        {
          text: "Cancel",
          onPress: () => console.log("Cancel Pressed"),
          style: "cancel"
        },
        {
          text: "OK", 
          onPress: () => {
            const totalvolume = height * width * length * pquantity;
            // const airlineCalc = totalvolume / 6000;
            const airlineCalc = totalvolume / 1;
            
            if (scaleData.reading) {
              // Use rawReading instead of parsing the string again
              const weightValue = scaleData.rawReading || parseFloat(scaleData.reading);
              
              setProducts((prevProducts) => [
                ...prevProducts,
                {
                  ...selectedProductType,
                  quantity: pquantity,
                  weight: weightValue,
                  productType: selectedProductType,
                  tVol: airlineCalc,
                  ht: height,
                  wd: width,
                  lt: length
                },
              ]);
              
              // IMPORTANT: Don't reset scaleData after capturing - this keeps the button usable
              // as long as the readings remain stable
              ToastAndroid.show("Product captured successfully!", ToastAndroid.SHORT);
              
              // Optional: Clear the form inputs but NOT the scale reading
              setSelectedProductType("");
              setQuantity("");
              setLength("");
              setWidth("");
              setHeight("");
            } else {
              ToastAndroid.show("No valid weight reading", ToastAndroid.SHORT);
            }
          }
        }
      ],
      { cancelable: false }
    );
  }}
  disabled={!scaleData.isStable}
>
  <Text style={[
    styles.textButton, 
    { color: scaleData.isStable ? "#FFFFFF" : "#999999" }
  ]}>
    {scaleData.isStable && scaleData.reading 
      ? `Capture (${scaleData.reading}kg)` 
      : "Waiting for stable reading..."}
  </Text>
</TouchableOpacity>

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
            {products.map((item, index) => (
              <TouchableOpacity onPress={() => handleDelete(index)}    style={styles.tableRow} key={index}>
                <Text style={styles.tableCell}>{item.productType}</Text>
                <Text style={styles.tableCell}>{item.quantity}</Text>
                <Text style={styles.tableCell}>{item.weight}kg</Text>
                <Text style={styles.tableCell}>{`${item.lt}*${item.wd}*${item.ht}`}</Text>
                <Text style={styles.tableCell}>{item.tVol.toFixed(1)} cm&#179;</Text>
              </TouchableOpacity>
            ))}
            <View style={styles.totalRow}>
              <Text style={styles.tableCell}>Total</Text>
              <Text style={styles.tableCell}>{totalQuantity}</Text>
              <Text style={styles.tableCell}>{totalWeight}kg</Text>
              <Text style={styles.tableCell}>N/A</Text>
              <Text style={styles.tableCell}>{totalVolume} cm&#179;</Text>
            </View>
            
          </View>
        </ScrollView>
      </View>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: loading ? "#ccc" : "green" }]}
        onPress={saveData}
      >
        {loading ? (
          <ActivityIndicator color="#00FF00" />
        ) : (
          <Text style={[styles.textButton, { color: "#fff" }]}>
            Save Record
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
  style={[
    styles.button, 
    { backgroundColor: loading ? "#ccc" : "#3498db" }
  ]}
  onPress={syncLocalRecordsToFirebase}
  disabled={loading}
>
  {loading ? (
    <ActivityIndicator color="#ffffff" />
  ) : (
    <Text style={[styles.textButton, { color: "#fff" }]}>
      Sync to Firebase
    </Text>
  )}
</TouchableOpacity>

    
    </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    paddingTop: 10,
    backgroundColor: "#F9F9F9",
  },
  paymentStatusContainer: {
    backgroundColor: "#f0f0f0",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 15,
    width: screenWidth * 0.8,
    alignItems: "center",
  },
  paymentStatusText: {
    fontSize: 16,
    fontFamily: "Poppins-Medium",
    color: "#333",
  },
  infoToggleButton: {
    backgroundColor: "#E0E0E0",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 10,
    width: screenWidth * 0.8,
    alignItems: "center",
  },
  infoToggleText: {
    fontSize: 14,
    fontFamily: "Poppins-Medium",
    color: "#333",
  },
  infoContainer: {
    backgroundColor: "#F2F2F2",
    padding: 16,
    borderRadius: 10,
    marginBottom: 15,
    width: screenWidth * 0.8,
  },
  infoTitle: {
    fontSize: 16,
    fontFamily: "Poppins-Bold",
    color: "#333",
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    fontFamily: "Poppins-Regular",
    color: "#333",
    marginBottom: 4,
  },
  display: {
    height: 100,
    width: screenWidth * 0.9,
    borderRadius: 10,
    flexDirection: "row",
    padding: 10,
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  data: {
    flex: 1,
  },
  centeredView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 22,
  },
  supplier:{
    padding:10,
    width: screenWidth * 0.8,
    marginBottom: 5,
    borderRadius: 20,
    borderWidth:2,
    borderColor:'grey'
  },
  dimensions:{
    padding:10,
    width: screenWidth * 0.2,
    margin: 5,
    borderRadius: 20,
    borderWidth:2,
    borderColor:'grey'
  },
  dimView:{
    flexDirection:'row'
  },
  modalView: {
    margin: 20,
    backgroundColor: "white",
    borderRadius: 20,
    padding: 35,
    width: screenWidth * 0.9,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  button: {
    width: screenWidth * 0.9,
    backgroundColor: "#F2F2F2",
    paddingVertical: 12,
    alignItems: "center",
    margin: 10,
    borderRadius: 50,
  },
  textButton: {
    fontFamily: "Poppins-Regular",
    fontSize: 16,
  },
  preview: {
    height: 'auto',
    backgroundColor: "#F2F2F2",
    borderRadius: 10,
    flex: 1,
    width: screenWidth * 0.9,
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 5,
    marginVertical: 10,
  },
  scroll: {
    backgroundColor: "white",
    width: "100%",
    borderRadius: 10,
  },
  table: {
    width: "100%",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#ddd",
  },
  tableHeader: {
    flex: 1,
    padding: 10,
    backgroundColor: "#f1f1f1",
    fontWeight: "bold",
    textAlign: "center",
  },
  tableCell: {
    flex: 1,
    padding: 10,
    textAlign: "center",
  },
  totalRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#f9f9f9",
  },
  textBold: {
    fontFamily: "Poppins-Bold",
    fontSize: 14,
    color: "white",
  },
  textRegular: {
    fontFamily: "Poppins-Regular",
    fontSize: 14,
    color: "white",
  },
  textWeight: {
    fontFamily: "Poppins-Regular",
    fontSize: 24,
    color: "white",
  },
  advancementSummary: {
    width: screenWidth * 0.8,
    backgroundColor: "#F2F2F2",
    padding: 15,
    borderRadius: 10,
    marginVertical: 10,
  },
  summaryText: {
    fontFamily: "Poppins-Regular",
    fontSize: 16,
    marginBottom: 5,
  },
  bottomSheetContent: {
    flex: 1,
    alignItems: "center",
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 20,
  },
  advanceTypeSelection: {
    flexDirection: "row",
    marginBottom: 20,
  },
  advanceTypeButton: {
    padding: 10,
    marginHorizontal: 10,
    borderWidth: 1,
    borderRadius: 5,
  },
  selectedAdvanceType: {
    backgroundColor: "#e0e0e0",
  },
  input: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 5,
    padding: 10,
    marginBottom: 10,
  },
  advanceButtonText: {
    color: "#000000",
    fontWeight: "bold",
  },
});

export default RecordPage;