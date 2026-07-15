import React, { useState } from 'react';
import { View, TextInput, Button } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { translate as i18nT } from '@/i18n'


type SetNewPasswordScreenProps = {
    route: {
        params: {
            token: string;
        };
    };
};

const SetNewPasswordScreen: React.FC<SetNewPasswordScreenProps> = ({ route }) => {
    const { token } = route.params; // Получить токен из параметров маршрута
    const [newPassword, setNewPasswordValue] = useState('');
    const { setNewPassword: submitNewPassword } = useAuth();

    const handleSetNewPassword = async () => {
        const success = await submitNewPassword(token, newPassword);
        if (success) {
            // Перейти на экран входа или показать сообщение об успешной смене пароля
        }
    };

    return (
        <View>
            <TextInput
                placeholder={i18nT('auth:components.user.SetNewPasswordScreen.novyy_parol_960e12df')}
                value={newPassword}
                onChangeText={setNewPasswordValue}
                secureTextEntry
            />
            <Button title={i18nT('auth:components.user.SetNewPasswordScreen.ustanovit_novyy_parol_3039d87d')} onPress={handleSetNewPassword} />
        </View>
    );
};

export default SetNewPasswordScreen;