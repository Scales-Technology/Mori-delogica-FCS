import React, { useState, useEffect } from 'react';
import {
  Text,
  StyleSheet,
  View,
  Dimensions,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ToastAndroid,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { auth, db } from '../Database/config';
import { collection, query, where, getDocs } from 'firebase/firestore';
import DropdownComponent from '../Components/DropDown';
import Header from '../Components/Header';
import data from '../store/dummyData';

const screenWidth = Dimensions.get('window').width;
const WEIGHT_UNIT = 'kg';

// Reusable InputField component
const InputField = ({ value, onChange, placeholder, keyboardType, style, error }) => (
  <View style={[styles.inputContainer, error && styles.inputError]}>
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      keyboardType={keyboardType}
      style={[styles.inputField, style]}
      accessibilityLabel={placeholder}
    />
    {error && <Text style={styles.errorText}>{error}</Text>}
  </View>
);

// Reusable CustomButton component
const CustomButton = ({ title, onPress, style, textStyle }) => (
  <TouchableOpacity
    onPress={onPress}
    style={[styles.button, style]}
    accessibilityRole="button"
    accessibilityLabel={title}
  >
    <Text style={[styles.buttonText, textStyle]}>{title}</Text>
  </TouchableOpacity>
);

const HomePage = () => {
  const navigation = useNavigation();
  const [appData] = useState(data);
  const [staffName, setStaffName] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // State for form inputs and errors
  const [form, setForm] = useState({
    senderName: '',
    senderPhone: '',
    senderIDNo: '',
    staffName: '',
    receiverName: '',
    receiverPhone: '',
    receiverIDNo: '',
    productName: '',
    paymentStatus: 'Unpaid',
  });
  const [formErrors, setFormErrors] = useState({});

  // Fetch staff name on component mount (for Header display)
  useEffect(() => {
    const fetchStaffName = async () => {
      try {
        const user = auth.currentUser;
        if (user) {
          if (user.displayName) {
            setStaffName(user.displayName);
            setForm((prev) => ({ ...prev, staffName: user.displayName }));
          } else {
            const q = query(collection(db, 'Users'), where('uid', '==', user.uid));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
              const userDoc = querySnapshot.docs[0].data();
              setStaffName(userDoc.name || 'Staff');
              setForm((prev) => ({ ...prev, staffName: userDoc.name || 'Staff' }));
            } else {
              setStaffName('Staff');
              setForm((prev) => ({ ...prev, staffName: 'Staff' }));
            }
          }
        } else {
          setStaffName('Staff');
          setForm((prev) => ({ ...prev, staffName: 'Staff' }));
          ToastAndroid.show('User not authenticated', ToastAndroid.SHORT);
        }
      } catch (err) {
        console.error('Error fetching staff name:', err);
        setStaffName('Staff');
        setForm((prev) => ({ ...prev, staffName: 'Staff' }));
        ToastAndroid.show('Error fetching staff name', ToastAndroid.SHORT);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStaffName();
  }, []);

  // Centralized form change handler
  const handleFormChange = (field) => (value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFormErrors((prev) => ({ ...prev, [field]: validateInput(field, value) }));
  };

  // Input validation
  const validateInput = (field, value) => {
    if (!value && ['senderName', 'receiverName'].includes(field)) {
      return 'This field is required';
    }
    if (field === 'senderPhone' || field === 'receiverPhone') {
      return value.match(/^\d{10}$/) ? '' : 'Enter a valid 10-digit phone number';
    }
    return '';
  };

  const handleStart = () => {
    const errors = {};
    ['senderName', 'receiverName'].forEach((field) => {
      const error = validateInput(field, form[field]);
      if (error) errors[field] = error;
    });

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      ToastAndroid.show('Please fill all required fields', ToastAndroid.SHORT);
      return;
    }

    navigation.navigate('RecordPage', {
      senderDetails: {
        name: form.senderName || 'Test Sender',
        phone: form.senderPhone || '0000000000',
        idNumber: form.senderIDNo || '12345678',
        staffName: form.staffName || 'Staff',
      },
      receiverDetails: {
        name: form.receiverName || 'Test Receiver',
        phone: form.receiverPhone || '0000000000',
        idNumber: form.receiverIDNo || '12345678',
      },
      productDetails: {
        name: form.productName || 'Test Product',
      },
      paymentInfo: {
        status: form.paymentStatus,
      },
    });
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#F9F9F9' }}>
      <View style={styles.container}>
        <Header staffName={staffName} navigation={navigation} />

        {/* Sender Company Details Section */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Sender Details</Text>
          <InputField
            value={form.senderName}
            onChange={handleFormChange('senderName')}
            placeholder="Sender Name"
            error={formErrors.senderName}
          />
          <InputField
            value={form.senderPhone}
            onChange={handleFormChange('senderPhone')}
            placeholder="Phone Number"
            keyboardType="phone-pad"
            error={formErrors.senderPhone}
          />
          <InputField
            value={form.senderIDNo}
            onChange={handleFormChange('senderIDNo')}
            placeholder="ID Number"
          />
          <Text style={styles.inputLabel}>Served by:</Text>
          <InputField
            value={form.staffName}
            onChange={handleFormChange('staffName')}
            placeholder="Your Name (Staff)"
          />
        </View>

        {/* Receiver Details Section */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Receiver Details</Text>
          <InputField
            value={form.receiverName}
            onChange={handleFormChange('receiverName')}
            placeholder="Receiver Name"
            error={formErrors.receiverName}
          />
          <InputField
            value={form.receiverPhone}
            onChange={handleFormChange('receiverPhone')}
            placeholder="Phone Number"
            keyboardType="phone-pad"
            error={formErrors.receiverPhone}
          />
          <InputField
            value={form.receiverIDNo}
            onChange={handleFormChange('receiverIDNo')}
            placeholder="ID Number"
          />
        </View>

        {/* Product Details Section */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Product Details</Text>
          <InputField
            value={form.productName}
            onChange={handleFormChange('productName')}
            placeholder="Product Name"
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
            data={[{ Name: 'Paid' }, { Name: 'Unpaid' }]}
            onChange={(item) => handleFormChange('paymentStatus')(item.Name)}
            defaultValue={form.paymentStatus}
          />
        </View>

        <CustomButton
          title="Start"
          onPress={handleStart}
          style={[styles.button_Bg, { marginTop: 20, marginBottom: 30 }]}
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    display: 'flex',
    backgroundColor: '#F9F9F9',
    paddingVertical: 10,
    paddingTop: 50,
    alignItems: 'center',
  },
  sectionContainer: {
    width: screenWidth * 0.9,
    marginTop: 20,
    backgroundColor: '#F2F2F2',
    borderRadius: 15,
    padding: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Poppins-Medium',
    marginBottom: 10,
    color: '#333',
  },
  inputContainer: {
    marginBottom: 10,
  },
  inputField: {
    padding: 12,
    width: '100%',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#FFF',
    fontFamily: 'Poppins-Regular',
  },
  inputError: {
    borderColor: 'red',
  },
  errorText: {
    color: 'red',
    fontSize: 12,
    marginTop: 2,
    marginLeft: 10,
    fontFamily: 'Poppins-Regular',
  },
  inputLabel: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#666',
    marginBottom: 5,
  },
  noteText: {
    fontFamily: 'Poppins-Italic',
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    fontStyle: 'italic',
  },
  buttonText: {
    fontSize: 16,
    fontFamily: 'Poppins-Medium',
    color: '#333',
  },
  button: {
    height: 50,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    width: screenWidth * 0.9,
  },
  button_Bg: {
    backgroundColor: '#E0E0E0',
    elevation: 2,
  },
});

export default HomePage;