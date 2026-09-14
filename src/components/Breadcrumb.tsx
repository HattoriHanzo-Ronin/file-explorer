import { useRef, type ComponentRef } from "react";
import { View, Pressable, Text } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { breadcrumb } from "../app/style";
import Ionicons from "react-native-vector-icons/Ionicons";

export default function Breadcrumb(props: { paths: string; onPress: (path: string) => void }) {
    const { paths, onPress } = props;
    const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
    const split = paths.split("/");

    return (
        <View style={breadcrumb.parent}>
            <ScrollView
                ref={scrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
            >
                <Pressable onPress={() => onPress(" ")}>
                    <Text>/ {paths[0] !== " " && <Ionicons name="chevron-forward-outline" size={10} />} </Text>
                </Pressable>
                {split.map((it, ind) => (
                    <Pressable
                        key={`${it}${ind}`}
                        onPress={() => {
                            if (ind !== split.length - 1) {
                                const tempSplit = split.slice(0, ind + 1);
                                let dir = split[0];

                                if (tempSplit.length > 1) {
                                    dir = tempSplit.join("/");
                                }

                                onPress(dir);
                            }
                        }}
                    >
                        <Text>
                            {it}{" "}
                            {it !== " " && ind !== split.length - 1 && (
                                <Ionicons name="chevron-forward-outline" size={10} />
                            )}{" "}
                        </Text>
                    </Pressable>
                ))}
            </ScrollView>
        </View>
    );
}
