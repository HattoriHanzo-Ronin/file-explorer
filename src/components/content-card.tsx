import { useEffect, useState } from "react";
import { Image, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-worklets";
import { contentCard } from "../app/style";
import { useAppContext } from "./app-context-provider";
import type { ContentCardProps } from "../types/components";
import { getTypeFile, icons } from "../utils/file-utils";

export default function ContentCard(props: ContentCardProps) {
    const { content, doubleTapAction, longPressAction, oneTapAction, notSelectable } = props;
    const context = useAppContext();
    const [select, setSelect] = useState<boolean>(false);
    const handleOnTap = () => {
        if (select) {
            setSelect(false);
        }

        oneTapAction();
    };
    const handleOnLongPress = () => {
        if (!notSelectable) {
            setSelect(!select);
        }

        longPressAction();
    };
    const tap = Gesture.Tap()
        .numberOfTaps(1)
        .onStart(() => runOnJS(handleOnTap)());
    const doubleTap = Gesture.Tap()
        .numberOfTaps(2)
        .onStart(() => runOnJS(doubleTapAction)());
    const longPress = Gesture.LongPress()
        .minDuration(400)
        .onEnd(() => runOnJS(handleOnLongPress)());
    const gestures = Gesture.Exclusive(doubleTap, tap, longPress);

    useEffect(() => {
        setSelect(false);
    }, [context.dirSelected]);

    return (
        <GestureDetector gesture={gestures}>
            <View style={[contentCard.parent, select ? { backgroundColor: "rgba(255, 255, 255, 0.36)" } : {}]}>
                <Image
                    resizeMode="cover"
                    style={{ height: "80%", width: "80%" }}
                    source={icons[content.type === "file" ? getTypeFile(content.name) : "dir"]}
                />
                <Text numberOfLines={1}>{content.name}</Text>
            </View>
        </GestureDetector>
    );
}
