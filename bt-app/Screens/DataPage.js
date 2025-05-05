import React, { useEffect, useState } from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View, FlatList, TextInput, ToastAndroid } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { store } from "../store/store";
import { useBluetooth } from "rn-bluetooth-classic";

const screenWidth = Dimensions.get("window").width;

const DataPage = () => {
  const [records, setRecords] = useState([]);
  const [filteredRecords, setFilteredRecords] = useState([]);
  const [search, setSearch] = useState("");

  const {
    devices,
    connectToDevice,
    receivedData,
    isConnected,
    disconnectDevice,
    writeToDevice,
    readFromDevice,
  } = useBluetooth();

  useEffect(() => {
    const fetchLocalData = async () => {
      try {
        const existingRecords = await AsyncStorage.getItem('localRecords');
        const records = existingRecords ? JSON.parse(existingRecords) : [];
        setRecords(records);
        setFilteredRecords(records); // Initialize with all records
      } catch (error) {
        alert("Error fetching local data: " + error.message);
      }
    };

    fetchLocalData();
  }, []);

  const showPrinterReceipt = async (item) => {
    try {
      const supplier = item.category || "N/A";
      const airweighbillnumber = item.awbnumber || "Unknown";
      const destinationLocation = item.destination || "Unknown";
      const tareweight = item.tareWeight || "N/A";
      const netweight = item.netWeight || "N/A";
      const ship = item.shipper || "N/A";
      const items = item.products || [];
      const separator = "------------------------------------------------\n";
      const pmcNumber = item.pmcnumber || "";
  
      let receiptData = "";
      receiptData += "    ====== RWANDAIR CARGO =====\n\n";
      receiptData += `  Category: ${supplier.padEnd(10, ' ')}\n`;
      receiptData += `  ULD Number: ${pmcNumber.padEnd(10, ' ')}\n`;
      receiptData += `  AWB: ${airweighbillnumber.padEnd(10, ' ')}\n`;
      receiptData += `  Destination: ${destinationLocation.padEnd(10, ' ')}\n`;
      receiptData += `  Shipper: ${ship.padEnd(10, '' )} \n`
      receiptData += `  Date:${new Date().toLocaleDateString().padEnd(9, ' ')} Time:${new Date().toLocaleTimeString()}\n\n`;
  
      receiptData += "------------------- Products -----------------\n";
      receiptData += "Commodity Qty  wgt(Kg)    Dim(cm)    T-Vol \n";
  
      let totalQuantity = 0;
      let totalWeight = 0;
      let totalVol = 0;
  
      items.forEach((item) => {
        const { label = item.productName || "Unknown", quantity = 0, weight = 0, lt = 0, wd = 0, ht = 0, tVol = 0 } = item;
        const qty = parseInt(quantity, 10);
        const wgt = parseFloat(weight);
        const tvol = parseFloat(tVol);
        const dim = lt && wd && ht ? `${lt}*${wd}*${ht}` : 'N/A';
  
        totalQuantity += qty;
        totalWeight += wgt;
        totalVol += tvol;
  
        receiptData += `${label.padEnd(8, ' ')} ${qty.toString().padStart(2, ' ')} ${wgt.toFixed(2).padStart(9, ' ')} ${dim.padStart(9, ' ')} ${tvol.toFixed(2).padStart(9, ' ')} \n`;
      });
  
      receiptData += separator;
      receiptData += `GW:    ${totalQuantity.toString().padStart(4, ' ')}   ${totalWeight.toFixed(2).padStart(8, ' ')} Kg    ${totalVol.toFixed(2).padStart(12, ' ')} cm3  \n\n`;
      receiptData += `Tare Weight: ${tareweight.toString().padStart(6, '') } Kg \n`
      receiptData += `Net Weight: ${netweight.toString().padStart(6, '')} Kg \n\n\n\n`
      receiptData += "   Thank you for your business!\n";
      receiptData += "   ===========================\n";
      receiptData += "\n\n\n";
  
      console.log(receiptData); 
  
      const printer = store.getState().settings.printerAddress;
      writeToDevice(printer, receiptData, "ascii");
      console.log("Receipt sent to the printer");
    } catch (error) {
      console.error("Error generating the receipt:", error);
    }
  };

  const handleSearch = (text) => {
    setSearch(text);
    const filteredData = records.filter(item => 
      item.awbnumber.toLowerCase().includes(text.toLowerCase())
    );
    setFilteredRecords(filteredData);
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity onPress={() => showPrinterReceipt(item)} style={styles.pressable}>
      <Text style={styles.dInfo}>Category: {item.category}</Text>
      <Text style={styles.dInfo1}>Weigh Bill Number: {item.awbnumber}</Text>
      <Text style={styles.dInfo2}>Date: {item.createdAt}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Warehouse Weight Records</Text>
      <TextInput
        value={search}
        onChangeText={(text) => handleSearch(text)}
        placeholder="Search by WB number..."
        style={styles.search}
      />
      <FlatList
        data={filteredRecords}
        renderItem={renderItem}
        keyExtractor={item => item.id}
      />
    </View>
  );
};

export default DataPage;

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flex: 1,
    paddingTop: 20,
  },
  header: {
    fontSize: 30,
    fontWeight: '900',
    color: '#0F084B',
    marginBottom: 20,
  },
  search: {
    padding: 10,
    borderWidth: 2,
    width: screenWidth * 0.8,
    marginBottom: 5,
    borderRadius: 20
  },
  pressable: {
    width: screenWidth * 0.9,
    padding: 10,
    margin: 5,
    backgroundColor: '#0F084B',
    borderRadius: 10,
  },
  dInfo: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 22
  },
  dInfo1: {
    color: '#E7B236',
    fontWeight: '800',
    fontSize: 18
  },
  dInfo2: {
    color: '#008F6D',
    fontWeight: '800',
    fontSize: 14
  }
});
