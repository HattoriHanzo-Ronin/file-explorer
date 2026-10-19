import { useEffect, useRef, useState } from "react";
import { Animated, Image, Modal, View } from "react-native";
import { loading } from "../styles/components/style";
import { useTheme } from "./theme-provider";
import { commonStyles } from "../styles/style";
import { useAppContext } from "./app-context-provider";

const MINIMUM_DISPLAY_MS = 1500;

export default function LoadingWindow() {
    const { isLoading } = useAppContext();
    const [visible, setVisible] = useState<boolean>(false);
    const [shownAt, setShownAt] = useState<number | null>(null);
    const { mode, theme } = useTheme();
    const common = commonStyles[mode];
    const scale = useRef(new Animated.Value(1)).current;
    const imageStyle = [loading.image, { transform: [{ scale }] }];

    useEffect(() => {
        if (isLoading) {
            setVisible(true);
            return undefined;
        }

        if (shownAt === null) {
            return undefined;
        }

        const remaining = Math.max(0, MINIMUM_DISPLAY_MS - (Date.now() - shownAt));
        const timeout = setTimeout(() => {
            setShownAt(null);
            setVisible(false);
        }, remaining);
        return () => clearTimeout(timeout);
    }, [isLoading, shownAt]);

    useEffect(() => {
        if (shownAt === null) {
            return undefined;
        }

        scale.setValue(1);
        const animation = Animated.loop(
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
        );
        animation.start();
        return () => animation.stop();
    }, [scale, shownAt]);

    return (
        <Modal animationType="fade" visible={visible} onShow={() => setShownAt(Date.now())}>
            <View style={[loading.parent, { backgroundColor: theme.background }]}>
                <Image
                    source={require("../../assets/images/background.jpg")}
                    resizeMode="cover"
                    style={[common.absoluteImage, common.contentBackgroundImage, loading.backgroundImage]}
                />
                <Animated.Image style={imageStyle} source={require("../../assets/images/icon.png")} />
            </View>
        </Modal>
    );
}
