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
import { collection, addDoc } from 'firebase/firestore';
import { db } from "../Database/config";
import DropdownComponent from "../Components/DropDown";
import Header from "../Components/Header";
import data from "../store/dummyData";
import AsyncStorage from '@react-native-async-storage/async-storage';

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

  // Product Details
  const [productName, setProductName] = useState("");

  const pushRecordsToFirebase = async () => {
    try {
      const existingRecords = await AsyncStorage.getItem('localRecords');
      const records = existingRecords ? JSON.parse(existingRecords) : [];

      Alert.alert(
        'Confirm Upload',
        'Are you sure you want to push the records to Firebase?',
        [
          {
            text: 'Cancel',
            onPress: () => console.log('Upload canceled'),
            style: 'cancel',
          },
          {
            text: 'OK',
            onPress: async () => {
              try {
                for (const record of records) {
                  await addDoc(collection(db, 'records'), record);
                }
                await AsyncStorage.removeItem('localRecords');
                ToastAndroid.show('Records pushed to Firebase successfully!', ToastAndroid.LONG);
              } catch (error) {
                alert('Error pushing records to Firebase: ' + error.message);
              }
            },
          },
        ],
        { cancelable: false }
      );
    } catch (error) {
      alert('Error fetching local data: ' + error.message);
    }
  };

  const handleStart = () => {
    navigation.navigate("RecordPage", {
      category: selectedCategory ? selectedCategory.Name : "Default Category",
      senderDetails: {
        name: senderName || "Test Sender",
        phone: senderPhone || "0000000000",
        idNumber: senderIDNo || "12345678",
        staffName: staffName || "Test Staff"
      },
      productDetails: {
        name: productName || "Test Product"
      }
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
        </View>

        {/* Product Details Section */}
        <View style={styles.sectionContainer}>
          <TextInput
            value={productName}
            onChangeText={setProductName}
            placeholder="Product Name"
            style={styles.inputField}
          />
          <Text style={styles.noteText}>Note: Parcel weight will be recorded on the next page</Text>
        </View>

        <TouchableOpacity
          onPress={handleStart}
          style={[styles.button, styles.button_Bg, { marginTop: 20 }]}
        >
          <Text style={styles.buttonText}>Start</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.button_Bg, { marginTop: 15, marginBottom: 30 }]}
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
    borderColor: '#ddd',
    backgroundColor: "#FFF",
    fontFamily: "Poppins-Regular",
  },
  noteText: {
    fontFamily: "Poppins-Italic",
    fontSize: 12,
    color: "#666",
    marginTop: 8,
    fontStyle: 'italic',
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
