import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { FtpStackParamList } from "../../types/navigation";
import Files from "./files";
import Login from "./login";

const Stack = createNativeStackNavigator<FtpStackParamList>();

export default function Ftp() {
    return (
        <Stack.Navigator initialRouteName="login" screenOptions={{ headerShown: false }}>
            <Stack.Screen name="login" component={Login} />
            <Stack.Screen name="files" component={Files} />
        </Stack.Navigator>
    );
}
