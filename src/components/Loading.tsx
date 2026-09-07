import { useEffect, useRef } from "react";
import { Animated, View } from "react-native";
import Background from "./Background";

// mostrara el icono latiendo
export default function Loading() {
    const scale = useRef(new Animated.Value(1)).current

    useEffect(() => {
        // Animación infinita de latido
        Animated.loop(
            Animated.sequence([
                // aumenta el tamaño
                Animated.timing(scale, {
                    toValue: 1.4,
                    duration: 1000,
                    useNativeDriver: true,
                }),
                // vuelve a tamaño normal
                Animated.timing(scale, {
                    toValue: 1,
                    duration: 500,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, [scale]);

    return (
        <Background>
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                <Animated.Image style={{ width: 200, height: 200, transform: [{ scale }] }} source={require("../../assets/images/icon.png")} />
            </View>
        </Background>
    )
}