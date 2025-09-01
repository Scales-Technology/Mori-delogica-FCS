import React, { useState } from "react";
import {
  Text,
  StyleSheet,
  View,
  Dimensions,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ToastAndroid,
  Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { collection, addDoc } from "firebase/firestore";
import { db } from "../Database/config";
import DropdownComponent from "../Components/DropDown";
import Header from "../Components/Header";
import data from "../store/dummyData";
import AsyncStorage from "@react-native-async-storage/async-storage";

const screenWidth = Dimensions.get("window").width;

const HomePage = () => {
  const navigation = useNavigation();
  const [appData] = useState(data);

  // Category (for incoming/outgoing)
  const [selectedCategory, setSelectedCategory] = useState("");

  // Sender Company Details
  const [senderName, setSenderName] = useState("");
  const [senderPhone, setSenderPhone] = useState("");
  const [senderIDNo, setSenderIDNo] = useState("");
  const [staffName, setStaffName] = useState("");
  const [senderLocation, setSenderLocation] = useState("");
  const [companyRepName, setCompanyRepName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [itemsFunctionality, setItemsFunctionality] = useState("");

  // Receiver Details
  const [receiverName, setReceiverName] = useState("");
  const [receiverPhone, setReceiverPhone] = useState("");
  const [receiverIDNo, setReceiverIDNo] = useState("");
  const [receiverLocationTown, setReceiverLocationTown] = useState("");
  const [receiverExactLocation, setReceiverExactLocation] = useState("");

  // Product Details
  const [productName, setProductName] = useState("");

  // Payment Status - set default value
  const [paymentStatus, setPaymentStatus] = useState("Unpaid");

  // Additional Fields from Feedback
  const [deliveryType, setDeliveryType] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [additionalCharges, setAdditionalCharges] = useState("");
  const [vat, setVat] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [driversName, setDriversName] = useState("");

  const pushRecordsToFirebase = async () => {
    try {
      const existingRecords = await AsyncStorage.getItem("localRecords");
      const records = existingRecords ? JSON.parse(existingRecords) : [];

      Alert.alert(
        "Confirm Upload",
        "Are you sure you want to push the records to Firebase?",
        [
          {
            text: "Cancel",
            onPress: () => console.log("Upload canceled"),
            style: "cancel",
          },
          {
            text: "OK",
            onPress: async () => {
              try {
                for (const record of records) {
                  // Ensure all new fields are included in the record
                  const recordWithPayment = {
                    ...record,
                    paymentStatus: record.paymentStatus || paymentStatus,
                    senderDetails: {
                      name: record.senderDetails?.name || "",
                      phone: record.senderDetails?.phone || "",
                      idNumber: record.senderDetails?.idNumber || "",
                      staffName: record.senderDetails?.staffName || "",
                      location: record.senderDetails?.location || "",
                      companyRepName:
                        record.senderDetails?.companyRepName || "",
                      jobTitle: record.senderDetails?.jobTitle || "",
                      itemsFunctionality:
                        record.senderDetails?.itemsFunctionality || "",
                    },
                    receiverDetails: {
                      name: record.receiverDetails?.name || "",
                      phone: record.receiverDetails?.phone || "",
                      idNumber: record.receiverDetails?.idNumber || "",
                      locationTown: record.receiverDetails?.locationTown || "",
                      exactLocation:
                        record.receiverDetails?.exactLocation || "",
                    },
                    deliveryInfo: {
                      deliveryType:
                        record.deliveryInfo?.deliveryType ||
                        deliveryType ||
                        "Same Day",
                      deliveryDate:
                        record.deliveryInfo?.deliveryDate ||
                        deliveryDate ||
                        "01/09/2025",
                      additionalCharges:
                        record.deliveryInfo?.additionalCharges ||
                        additionalCharges ||
                        "0",
                      vat: record.deliveryInfo?.vat || vat || "0",
                      totalAmount:
                        record.deliveryInfo?.totalAmount ||
                        totalAmount ||
                        "514600",
                      specialInstructions:
                        record.deliveryInfo?.specialInstructions ||
                        specialInstructions ||
                        "",
                      driversName:
                        record.deliveryInfo?.driversName ||
                        driversName ||
                        "Test Driver",
                    },
                  };
                  await addDoc(collection(db, "records"), recordWithPayment);
                }
                await AsyncStorage.removeItem("localRecords");
                ToastAndroid.show(
                  "Records pushed to Firebase successfully!",
                  ToastAndroid.LONG
                );
              } catch (error) {
                alert("Error pushing records to Firebase: " + error.message);
              }
            },
          },
        ],
        { cancelable: false }
      );
    } catch (error) {
      alert("Error fetching local data: " + error.message);
    }
  };

  const handleStart = () => {
    navigation.navigate("RecordPage", {
      category: selectedCategory ? selectedCategory.Name : "Default Category",
      senderDetails: {
        name: senderName || "",
        phone: senderPhone || "",
        idNumber: senderIDNo || "",
        staffName: staffName || "",
        location: senderLocation || "",
        companyRepName: companyRepName || "",
        jobTitle: jobTitle || "",
        itemsFunctionality: itemsFunctionality || "",
      },
      receiverDetails: {
        name: receiverName || "",
        phone: receiverPhone || "",
        idNumber: receiverIDNo || "",
        locationTown: receiverLocationTown || "",
        exactLocation: receiverExactLocation || "",
      },
      productDetails: {
        name: productName || "Test Product",
      },
      paymentInfo: {
        status: paymentStatus,
      },
      deliveryInfo: {
        deliveryType: deliveryType || "Same Day",
        deliveryDate: deliveryDate || "01/09/2025",
        additionalCharges: additionalCharges || "0",
        vat: vat || "0",
        totalAmount: totalAmount || "514600",
        specialInstructions: specialInstructions || "",
        driversName: driversName || "Test Driver",
      },
    });
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#F9F9F9" }}>
      <View style={styles.container}>
        <Header />

        {/* Category Selection */}
        <View style={styles.sectionContainer}>
          <DropdownComponent
            title={"Select Category"}
            onChange={setSelectedCategory}
            data={appData.category}
          />
        </View>

        {/* Sender Company Details Section */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Sender Details</Text>
          <TextInput
            value={senderName}
            onChangeText={setSenderName}
            placeholder="Sender Name"
            style={styles.inputField}
          />
          <TextInput
            value={senderPhone}
            onChangeText={setSenderPhone}
            placeholder="Phone Number"
            keyboardType="phone-pad"
            style={styles.inputField}
          />
          <TextInput
            value={senderIDNo}
            onChangeText={setSenderIDNo}
            placeholder="ID Number"
            style={styles.inputField}
          />
          <TextInput
            value={staffName}
            onChangeText={setStaffName}
            placeholder="Staff Name"
            style={styles.inputField}
          />
          <TextInput
            value={senderLocation}
            onChangeText={setSenderLocation}
            placeholder="Location"
            style={styles.inputField}
          />
          <TextInput
            value={companyRepName}
            onChangeText={setCompanyRepName}
            placeholder="Company Rep Name (Optional)"
            style={styles.inputField}
          />
          <TextInput
            value={jobTitle}
            onChangeText={setJobTitle}
            placeholder="Job Title (Optional)"
            style={styles.inputField}
          />
          <TextInput
            value={itemsFunctionality}
            onChangeText={setItemsFunctionality}
            placeholder="Items Functionality"
            style={styles.inputField}
          />
        </View>

        {/* Receiver Details Section */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Receiver Details</Text>
          <TextInput
            value={receiverName}
            onChangeText={setReceiverName}
            placeholder="Receiver Name"
            style={styles.inputField}
          />
          <TextInput
            value={receiverPhone}
            onChangeText={setReceiverPhone}
            placeholder="Phone Number"
            keyboardType="phone-pad"
            style={styles.inputField}
          />
          <TextInput
            value={receiverIDNo}
            onChangeText={setReceiverIDNo}
            placeholder="ID Number"
            style={styles.inputField}
          />
          <TextInput
            value={receiverLocationTown}
            onChangeText={setReceiverLocationTown}
            placeholder="Location: Town"
            style={styles.inputField}
          />
          <TextInput
            value={receiverExactLocation}
            onChangeText={setReceiverExactLocation}
            placeholder="Exact Location"
            style={styles.inputField}
          />
        </View>

        {/* Product Details Section */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Product Details</Text>
          <TextInput
            value={productName}
            onChangeText={setProductName}
            placeholder="Product Name"
            style={styles.inputField}
          />
          <Text style={styles.noteText}>
            Note: Parcel weight will be recorded on the next page
          </Text>
        </View>

        {/* Payment Info Section */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Payment Information</Text>
          <DropdownComponent
            title="Payment Status"
            data={[{ Name: "Paid" }, { Name: "Unpaid" }]}
            onChange={(item) => setPaymentStatus(item.Name)}
            defaultValue={paymentStatus}
          />
        </View>

        {/* Delivery Info Section */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Delivery Information</Text>
          <TextInput
            value={deliveryType}
            onChangeText={setDeliveryType}
            placeholder="Delivery Type (e.g., Same Day, Next Day)"
            style={styles.inputField}
          />
          <TextInput
            value={deliveryDate}
            onChangeText={setDeliveryDate}
            placeholder="Delivery Date (e.g., 01/09/2025)"
            style={styles.inputField}
          />
          <TextInput
            value={additionalCharges}
            onChangeText={setAdditionalCharges}
            placeholder="Additional Charges"
            keyboardType="numeric"
            style={styles.inputField}
          />
          <TextInput
            value={vat}
            onChangeText={setVat}
            placeholder="VAT"
            keyboardType="numeric"
            style={styles.inputField}
          />
          <TextInput
            value={totalAmount}
            onChangeText={setTotalAmount}
            placeholder="Total Amount"
            keyboardType="numeric"
            style={styles.inputField}
          />
          <TextInput
            value={specialInstructions}
            onChangeText={setSpecialInstructions}
            placeholder="Special Instructions"
            style={styles.inputField}
          />
          <TextInput
            value={driversName}
            onChangeText={setDriversName}
            placeholder="Driver's Name"
            style={styles.inputField}
          />
        </View>

        <TouchableOpacity
          onPress={handleStart}
          style={[styles.button, styles.button_Bg, { marginTop: 20 }]}
        >
          <Text style={styles.buttonText}>Start</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.button,
            styles.button_Bg,
            { marginTop: 15, marginBottom: 30 },
          ]}
          onPress={pushRecordsToFirebase}
        >
          <Text style={styles.buttonText}>Synchronize</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    display: "flex",
    backgroundColor: "#F9F9F9",
    paddingVertical: 10,
    paddingTop: 50,
    alignItems: "center",
  },
  sectionContainer: {
    width: screenWidth * 0.9,
    marginTop: 20,
    backgroundColor: "#F2F2F2",
    borderRadius: 15,
    padding: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "Poppins-Medium",
    marginBottom: 10,
    color: "#333",
  },
  inputField: {
    padding: 12,
    width: "100%",
    marginBottom: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#FFF",
    fontFamily: "Poppins-Regular",
  },
  noteText: {
    fontFamily: "Poppins-Italic",
    fontSize: 12,
    color: "#666",
    marginTop: 8,
    fontStyle: "italic",
  },
  buttonText: {
    fontSize: 16,
    fontFamily: "Poppins-Medium",
    color: "#333",
  },
  button: {
    height: 50,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    width: screenWidth * 0.9,
  },
  button_Bg: {
    backgroundColor: "#E0E0E0",
    elevation: 2,
  },
});

export default HomePage;
