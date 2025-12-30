import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';

interface ForgotPasswordLinkProps {
  onPress: () => void;
}

const ForgotPasswordLink: React.FC<ForgotPasswordLinkProps> = ({ onPress }) => {
  return (
    <TouchableOpacity onPress={onPress}>
      <Text style={{ color: DESIGN_TOKENS.colors.info, textDecorationLine: 'underline' }}>
        Забыли пароль?
      </Text>
    </TouchableOpacity>
  );
};

export default ForgotPasswordLink;
