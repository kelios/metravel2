import React, { memo } from 'react';
import { View } from 'react-native';

interface FilterRadioProps {
  checked: boolean;
  radioStyle: any;
  radioCheckedStyle: any;
  radioDotStyle: any;
}

const FilterRadio = memo(({ checked, radioStyle, radioCheckedStyle, radioDotStyle }: FilterRadioProps) => (
  <View style={[radioStyle, checked && radioCheckedStyle]}>
    {checked && <View style={radioDotStyle} />}
  </View>
));

FilterRadio.displayName = 'FilterRadio';

export default FilterRadio;

