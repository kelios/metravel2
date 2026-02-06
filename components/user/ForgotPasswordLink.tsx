import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { useThemedColors } from '@/hooks/useTheme';

interface ForgotPasswordLinkProps {
  onPress: () => void;
}

const ForgotPasswordLink: React.FC<ForgotPasswordLinkProps> = ({ onPress }) => {
  const colors = useThemedColors();

  return (
    <TouchableOpacity onPress={onPress}>
      <Text style={{ color: colors.info, textDecorationLine: 'underline' }}>
        Забыли пароль?
      </Text>
    </TouchableOpacity>
  );
};

export default ForgotPasswordLink;
