import React from 'react';
import { Text, View, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import AntDesign from "@expo/vector-icons/AntDesign";
import { store } from '../store/store';

const screenWidth = Dimensions.get("window").width;

const Header = ({ refresh, handleClick, staffName }) => {
  const user = store.getState().settings.user;

  console.log('Header staffName:', staffName); // Debug log
  console.log(user);

  return (
    <View style={styles.headingContainer}>
      <View style={styles.textContainer}>
        <Text style={styles.heading}>Welcome ✈️</Text>
        <Text style={styles.subtitle}>Hello, {staffName}</Text>
      </View>
      <TouchableOpacity disabled={refresh} onPress={handleClick}>
        <AntDesign name="reload1" size={24} color="black" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  headingContainer: {
    width: screenWidth * 0.9,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  textContainer: {
    flexDirection: "column",
  },
  heading: {
    fontSize: 20,
    fontWeight: "semibold",
    fontFamily: 'Poppins-SemiBold',
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: '#333',
  },
});

export default Header;