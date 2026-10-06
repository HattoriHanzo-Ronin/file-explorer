import { useEffect, useState } from "react";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { StyleSheet, View } from "react-native";
import { Button, Text, TextInput } from "react-native-paper";
import Background from "../../../components/background";
import { useAppContext } from "../../../components/app-context-provider";
import type { ApiValidationErrorDetail } from "../../../types/api-error";
import type { FtpStackParamList } from "../../../types/navigation";

function getValidationMessage(details: ApiValidationErrorDetail[] | undefined, field: string): string {
    return details?.find((detail) => detail.field === field)?.message ?? "";
}

export default function Login() {
    const { authUtils, isAuthenticated, loadingUtils } = useAppContext();
    const navigation = useNavigation<NativeStackNavigationProp<FtpStackParamList>>();
    const [username, setUsername] = useState<string>("");
    const [password, setPassword] = useState<string>("");
    const [usernameError, setUsernameError] = useState<string>("");
    const [passwordError, setPasswordError] = useState<string>("");

    async function handleLogin() {
        const normalizedUsername = username.trim();
        setUsernameError(normalizedUsername ? "" : "Introduce el usuario");
        setPasswordError(password ? "" : "Introduce la contraseña");
        if (!normalizedUsername || !password) {
            return;
        }

        const validationDetails = await loadingUtils.run(() =>
            authUtils.login({ username: normalizedUsername, password })
        );
        setUsernameError(getValidationMessage(validationDetails, "username"));
        setPasswordError(getValidationMessage(validationDetails, "password"));
    }

    useEffect(() => {
        void loadingUtils.run(() => authUtils.restoreSession());
    }, [authUtils, loadingUtils]);

    useEffect(() => {
        if (isAuthenticated) {
            navigation.replace("files");
        }
    }, [isAuthenticated, navigation]);

    return (
        <Background>
            <View style={styles.container}>
                <Text variant="headlineMedium">File Explorer</Text>
                <TextInput
                    label="Usuario"
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                    autoCorrect={false}
                    error={Boolean(usernameError)}
                />
                {usernameError ? <Text style={styles.error}>{usernameError}</Text> : null}
                <TextInput
                    label="Contraseña"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    error={Boolean(passwordError)}
                />
                {passwordError ? <Text style={styles.error}>{passwordError}</Text> : null}
                <Button mode="contained" onPress={handleLogin}>
                    Iniciar sesión
                </Button>
            </View>
        </Background>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: "center",
        gap: 12,
        padding: 32
    },
    error: {
        color: "#ba1a1a"
    }
});
