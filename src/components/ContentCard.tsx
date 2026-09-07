import { useEffect, useState } from "react";
import { Image, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-worklets";
import { contentCard } from "../app/style";
import { DirContent, useAppContext } from "./AppContextProvider";
import { getTypeFile, icons } from "../utils/FileUtils";



export default function ContentCard(props: { content: DirContent, doubleTapAction: () => void, longPressAction: () => void, oneTapAction: () => void, notSelectable: boolean }) {
    // objeto que tendra los tipos de iconos
    const context = useAppContext(),
        // controla el estado de si esta selecionado
        [select, setSelect] = useState(false),
        // recogera cualquier funcion para un press
        handleOnTap = () => {
            if (select) setSelect(false)
            props.oneTapAction()
        },
        // recogera cualquier funcion para un presionado largo
        handleOnLongPress = () => {
            if (!props.notSelectable) setSelect(!select)
            props.longPressAction()
        },
        // variable que ejecutaran los distintos tipo de press 
        tap = Gesture.Tap().numberOfTaps(1).onStart(() => runOnJS(handleOnTap)()),
        doubleTap = Gesture.Tap().numberOfTaps(2).onStart(() => runOnJS(props.doubleTapAction)()),
        longPress = Gesture.LongPress().minDuration(400).onEnd(() => runOnJS(handleOnLongPress)()),
        gestures = Gesture.Exclusive(doubleTap, tap, longPress)

    useEffect(() => {
        setSelect(false)
    }, [context.dirSelected])

    return (
        <GestureDetector gesture={gestures}>
            <View style={[contentCard.parent, select ? { backgroundColor: "rgba(255, 255, 255, 0.36)" } : {}]}>
                <Image resizeMode="cover" style={{ height: "80%", width: "80%" }} source={icons[props.content.type === "file" ? getTypeFile(props.content.name) : "dir"]} />
                <Text numberOfLines={1}>{props.content.name}</Text>
            </View>
        </GestureDetector>
    )
}