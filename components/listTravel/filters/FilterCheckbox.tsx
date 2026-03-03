import React, { memo } from 'react';
import { View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

interface FilterCheckboxProps {
  checked: boolean;
  checkboxStyle: any;
  checkboxCheckedStyle: any;
  checkColor: string;
}

const FilterCheckbox = memo(({ checked, checkboxStyle, checkboxCheckedStyle, checkColor }: FilterCheckboxProps) => (
  <View style={[checkboxStyle, checked && checkboxCheckedStyle]}>
    {checked && <Feather name="check" size={14} color={checkColor} />}
  </View>
));

FilterCheckbox.displayName = 'FilterCheckbox';

export default FilterCheckbox;

