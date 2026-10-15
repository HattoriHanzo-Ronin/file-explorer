import { useEffect, useRef } from "react";
import { Animated, Image, Modal, View } from "react-native";
import { loading } from "../styles/components/style";
import { useTheme } from "./theme-provider";
import { commonStyles } from "../styles/style";

export default function Loading() {
    const { mode, theme } = useTheme();
    const common = commonStyles[mode];
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
        <Modal animationType="fade" visible>
            <View style={[loading.parent, { backgroundColor: theme.background }]}>
                <Image
                    source={require("../../assets/images/background.jpg")}
                    resizeMode="cover"
                    style={[common.absoluteImage, common.contentBackgroundImage, { opacity: 0.1 }]}
                />
                <Animated.Image style={imageStyle} source={require("../../assets/images/icon.png")} />
            </View>
        </Modal>
    );
}
