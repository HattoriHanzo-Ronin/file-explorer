import { useEffect, useState } from "react";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import Background from "../../../components/background";
import { useAppContext } from "../../../components/app-context-provider";
import type { ApiValidationErrorDetail } from "../../../types/api-error";
import type { FtpStackParamList } from "../../../types/navigation";
import { login } from "../../../styles/app/ftp/style";

function getValidationMessage(details: ApiValidationErrorDetail[] | undefined, field: string): string {
    return details?.find(({ field: detailField }) => detailField === field)?.message ?? "";
}

export default function Login() {
    const { authUtils, isAuthenticated, isLoading, loadingUtils } = useAppContext();
    const navigation = useNavigation<NativeStackNavigationProp<FtpStackParamList>>();
    const [username, setUsername] = useState<string>("");
    const [password, setPassword] = useState<string>("");
    const [usernameError, setUsernameError] = useState<string>("");
    const [passwordError, setPasswordError] = useState<string>("");
    const [showPassword, setShowPassword] = useState<boolean>(false);

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
            <View style={login.container}>
                <Text style={login.label}>Usuario</Text>
                <TextInput
                    style={login.input}
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                    autoCorrect={false}
                />
                {usernameError ? <Text style={login.error}>{usernameError}</Text> : null}
                <Text style={login.label}>Contraseña</Text>
                <View style={login.passwordField}>
                    <TextInput
                        style={login.passwordInput}
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={!showPassword}
                    />
                    <Pressable onPress={() => setShowPassword((current) => !current)}>
                        <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={24} />
                    </Pressable>
                </View>
                {passwordError ? <Text style={login.error}>{passwordError}</Text> : null}
                <Pressable disabled={isLoading} style={login.submitButton} onPress={() => void handleLogin()}>
                    {isLoading ? <ActivityIndicator color="white" /> : <Text style={login.submitText}>Iniciar sesión</Text>}
                </Pressable>
            </View>
        </Background>
    );
}
