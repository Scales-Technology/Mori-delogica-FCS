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

  const [scaleData, setScaleData] = useState({ });
  useEffect(() => {
    if (receivedData) {
      const parsedData = parseBluetoothData(receivedData);
  
      // Ensure parsedData.reading is not null before proceeding
      if (parsedData.reading !== null && JSON.stringify(parsedData) !== JSON.stringify(scaleData)) {
        setScaleData(parsedData);
        console.log("PARSED", parsedData);
        console.log("scaledata:", scaleData);
      }
    }
  }, [receivedData]);

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
    // const newTotalPrice = newTotalWeight * product.price;
    setTotalQuantity(newTotalQuantity);
    setTotalWeight(newTotalWeight.toFixed(2));
    setNetWeight(newNetWeight.toFixed(2));
    setTotalVolume(newTotalVolume.toFixed(1));

    // setTotalPrice(newTotalPrice.toFixed(2));
  }, [products]);

const parseBluetoothData = (data) => {
  console.log("Received data:", data);

  let numericValue = null;

  // Try to extract a numeric value from the data
  if (typeof data === 'string') {
    // First, try to decode if it's base64 encoded
    try {
      const decodedData = atob(data);
      const match = decodedData.match(/-?\d+(\.\d+)?/);
      if (match) {
        numericValue = parseFloat(match[0]);
      }
    } catch (error) {
      // If decoding fails, it's not base64, so we'll try to extract numbers directly
      const match = data.match(/-?\d+(\.\d+)?/);
      if (match) {
        console.log("value",match)
        numericValue = parseFloat(match[0]);
      }
    }
  } else if (typeof data === 'number') {
    console.log("test",data);
    numericValue = data;
  }

  // If we found a valid numeric value, return it with 'kg' appended
  if (numericValue !== null) {
    console.log("Check1", numericValue)

    return {
      reading: numericValue.toFixed(2) + 'kg',
      isStable: true // Always set to true as per requirement
    };
  }

  // If no valid numeric value was found, return null reading
  return {
     reading: null,
    isStable: true // Always set to true as per requirement
  };
};
  
const handleSwitchBt = async () => {
    const printer = store.getState().settings.printerAddress;
    connectToDevice(printer);
    console.log("Printer: ", printer);
  };

const saveDataLocally = async () => {
  const record = {
    selectedSupplier,
    category,
    awbnumber,
    selectedProductType,
    shipper,
    products,
    netWeight,
    totalWeight,
    tareWeight,
    paymentStatus,
    senderDetails, // Add sender details to the record
    receiverDetails, // Add receiver details to the record
    createdAt: new Date(),
  };

  try {
    const existingRecords = await AsyncStorage.getItem('localRecords');
    const records = existingRecords ? JSON.parse(existingRecords) : [];
    records.push(record);
    await AsyncStorage.setItem('localRecords', JSON.stringify(records));
    ToastAndroid.show("Record saved locally!", ToastAndroid.LONG);
    setModalVisible(true);
    // Reset Data
  } catch (error) {
    alert("Error saving record locally: " + error.message);
  }
};

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
            onPress: saveDataLocally
          }
        ],
        { cancelable: false }
      );
    } else {
      alert("Please select all fields before saving.");
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
          style={styles.button}
          onPress={() => {
            Alert.alert(
              "Confirm Capture",
              "Are you sure you want to capture this product?",
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
                      setProducts((prevProducts) => [
                        ...prevProducts,
                        {
                          ...selectedProductType,
                          quantity: pquantity,
                          weight: parseFloat(scaleData.reading),
                          productType: selectedProductType,
                          tVol: airlineCalc,
                          ht: height,
                          wd: width,
                          lt: length
                        },
                      ]);
                    } else {
                      ToastAndroid.show("No valid weight reading", ToastAndroid.SHORT);
                    }
                  }
                }
              ],
              { cancelable: false }
            );
          }}
        >
          <Text style={styles.textButton}>Capture</Text>
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