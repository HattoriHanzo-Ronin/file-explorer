import { useEffect, useState } from "react";
import { Image, Text, View } from "react-native";
import {
    GestureDetector,
    useExclusiveGestures,
    useLongPressGesture,
    useTapGesture
} from "react-native-gesture-handler";
import { contentCard } from "../app/style";
import { useAppContext } from "./app-context-provider";
import type { ContentCardProps } from "../types/components";
import type { FileIcons } from "../types/files";
import FileUtils from "../utils/file-utils";

const FILE_ICONS: FileIcons = {
    dir: require("../../assets/images/folder.png"),
    file: require("../../assets/images/file.png"),
    image: require("../../assets/images/image.png"),
    video: require("../../assets/images/video.png"),
    audio: require("../../assets/images/audio.png"),
    compress: require("../../assets/images/compress.png"),
    pdf: require("../../assets/images/pdf.png"),
    word: require("../../assets/images/word.png"),
    excel: require("../../assets/images/excel.png"),
    power: require("../../assets/images/power.png"),
    apk: require("../../assets/images/apk.png"),
    exe: require("../../assets/images/exe.png"),
    code: require("../../assets/images/code.png")
};

export default function ContentCard(props: ContentCardProps) {
    const { content, doubleTapAction, longPressAction, oneTapAction, notSelectable } = props;
    const { dirSelected } = useAppContext();
    const [select, setSelect] = useState<boolean>(false);
    const fileType = content.type.toLocaleLowerCase() === "file" ? FileUtils.getTypeFile(content.name) : "dir";

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
    const tap = useTapGesture({ numberOfTaps: 1, onActivate: handleOnTap, runOnJS: true });
    const doubleTap = useTapGesture({ numberOfTaps: 2, onActivate: doubleTapAction, runOnJS: true });
    const longPress = useLongPressGesture({ minDuration: 400, onDeactivate: handleOnLongPress, runOnJS: true });
    const gestures = useExclusiveGestures(doubleTap, tap, longPress);

    useEffect(() => {
        setSelect(false);
    }, [dirSelected]);

    return (
        <GestureDetector gesture={gestures}>
            <View style={[contentCard.parent, select && contentCard.selected]}>
                <Image resizeMode="cover" style={contentCard.icon} source={FILE_ICONS[fileType]} />
                <Text numberOfLines={1}>{content.name}</Text>
            </View>
        </GestureDetector>
    );
}
