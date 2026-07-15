import { useState } from 'react';
import { View, TextInput, Button } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { translate as i18nT } from '@/i18n'


const ForgotPasswordScreen = () => {
    const [email, setEmail] = useState('');
    const { sendPassword } = useAuth();

    const handleSendPassword = async () => {
        const success = await sendPassword(email);
        if (success) {
            // Перейти на экран входа или показать сообщение об успешной отправке
        }
    };

    return (
        <View>
            <TextInput
                placeholder={i18nT('auth:components.user.ForgotPasswordScreen.email_2810658d')}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
            />
            <Button title={i18nT('auth:components.user.ForgotPasswordScreen.otpravit_instruktsiyu_df6218a6')} onPress={handleSendPassword} />
        </View>
    );
};

export default ForgotPasswordScreen;