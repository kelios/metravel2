import React from 'react';
import { Text, TouchableOpacity } from 'react-native';

interface ForgotPasswordLinkProps {
  onPress: () => void;
}

const ForgotPasswordLink: React.FC<ForgotPasswordLinkProps> = ({ onPress }) => {
  return (
    <TouchableOpacity onPress={onPress}>
      <Text style={{ color: '#0066ff', textDecorationLine: 'underline' }}>
        Забыли пароль?
      </Text>
    </TouchableOpacity>
  );
};

export default ForgotPasswordLink;
