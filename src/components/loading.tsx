import { useEffect, useRef } from "react";
import { Animated, View } from "react-native";
import Background from "./background";
import { loading } from "../app/style";

export default function Loading() {
    const scale = useRef(new Animated.Value(1)).current;
    const imageStyle = [loading.image, { transform: [{ scale }] }];

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(scale, {
                    toValue: 1.4,
                    duration: 1000,
                    useNativeDriver: true
                }),
                Animated.timing(scale, {
                    toValue: 1,
                    duration: 500,
                    useNativeDriver: true
                })
            ])
        ).start();
    }, [scale]);

    return (
        <Background>
            <View style={loading.parent}>
                <Animated.Image style={imageStyle} source={require("../../assets/images/icon.png")} />
            </View>
        </Background>
    );
}
