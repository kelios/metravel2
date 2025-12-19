import React, { useState } from 'react';
import { View, TextInput, Button } from 'react-native';
import { useAuth } from '@/context/AuthContext';

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
                placeholder="Новый пароль"
                value={newPassword}
                onChangeText={setNewPasswordValue}
                secureTextEntry
            />
            <Button title="Установить новый пароль" onPress={handleSetNewPassword} />
        </View>
    );
};

export default SetNewPasswordScreen;