import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { useThemedColors } from '@/hooks/useTheme';
import { translate as i18nT } from '@/i18n'


interface ForgotPasswordLinkProps {
  onPress: () => void;
}

const ForgotPasswordLink: React.FC<ForgotPasswordLinkProps> = ({ onPress }) => {
  const colors = useThemedColors();

  return (
    <TouchableOpacity onPress={onPress}>
      <Text style={{ color: colors.info, textDecorationLine: 'underline' }}>
        {i18nT('auth:components.user.ForgotPasswordLink.zabyli_parol_2494d9db')}</Text>
    </TouchableOpacity>
  );
};

export default ForgotPasswordLink;
