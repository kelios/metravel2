import React, { useState } from 'react';
import { View, TextInput, Button } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { showToast } from '@/utils/toast';
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
        // #2127: результат показывается тостом — раньше его показывал Alert слоя api.
        const outcome = await submitNewPassword(token, newPassword);
        if (outcome.message) {
            void showToast({ type: outcome.ok ? 'success' : 'error', text1: outcome.message, position: 'bottom' });
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