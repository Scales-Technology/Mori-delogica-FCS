import React, { useState } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Dropdown } from 'react-native-element-dropdown';
import AntDesign from '@expo/vector-icons/AntDesign';

const DropdownComponent = ({ title, data, onChange }) => {
  const [value, setValue] = useState("");

  const renderItem = item => {
    return (
      <View style={styles.item}>
        <Text style={[styles.textItem, {color: item.value === value ? 'blue' : 'black'}]}>
          {item.Name}
        </Text>
        {item.value === value && (
          <AntDesign
            style={styles.icon}
            color="blue"
            name="Safety"
            size={20}
          />
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Displaying the title above the dropdown */}
      <Text style={styles.titleText}>{title}</Text>
      
      {/* Dropdown Component */}
      <Dropdown
        style={styles.dropdown}
        placeholderStyle={styles.placeholderStyle}
        selectedTextStyle={styles.selectedTextStyle}
        inputSearchStyle={styles.inputSearchStyle}
        iconStyle={styles.iconStyle}
        data={data}
        search
        maxHeight={300}
        labelField="Name"
        valueField="value"
        placeholder={`Select ${title}`}
        searchPlaceholder="Search..."
        value={value}
        onChange={item => {
          setValue(item.value);
          onChange && onChange(item)
        }}
        renderLeftIcon={() => (
          <AntDesign style={styles.icon} color="black" name="Safety" size={20} />
        )}
        renderItem={renderItem}
      />
    </View>
  );
};

export default DropdownComponent;

const styles = StyleSheet.create({
  container: {
    margin: 16,
  },
  titleText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  dropdown: {
    height: 50,
    width: 300,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  icon: {
    marginRight: 5,
  },
  item: {
    paddingVertical: 15,
    paddingHorizontal: 17,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F9F9F9',
    borderBottomWidth: 1,
    borderColor: '#E0E0E0',
  },
  textItem: {
    flex: 1,
    fontSize: 16,
    color: 'black',
  },
  placeholderStyle: {
    fontSize: 16,
    color: '#C4C4C4',
  },
  selectedTextStyle: {
    fontSize: 16,
    color: 'black',
  },
  iconStyle: {
    width: 20,
    height: 20,
  },
  inputSearchStyle: {
    height: 40,
    fontSize: 16,
    paddingHorizontal: 10,
    backgroundColor: '#F9F9F9',
    borderRadius: 10,
  },
});
