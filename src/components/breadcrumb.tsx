import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useRef, type ComponentRef } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useTheme } from "./theme-provider";
import { appStyles } from "../styles/app/style";
import type { BreadcrumbProps } from "../types/components";

export default function Breadcrumb(props: BreadcrumbProps) {
    const { dir, onNavigate } = props;
    const { mode, theme } = useTheme();
    const app = appStyles[mode];
    const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
    const paths = dir === " " ? [] : dir.split("/");

    return (
        <View style={app.breadcrumb}>
            <ScrollView
                ref={scrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                style={app.breadcrumbScroll}
                contentContainerStyle={app.breadcrumbContent}
                onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
            >
                <View style={app.breadcrumbPath}>
                    <Pressable onPress={() => onNavigate(" ")}>
                        <Text style={app.breadcrumbText}>
                            /{" "}
                            {paths.length > 0 && (
                                <Ionicons name="chevron-forward-outline" color={theme.text} size={10} />
                            )}
                        </Text>
                    </Pressable>
                    {paths.map((path, index) => (
                        <Pressable
                            key={`${path}${index}`}
                            onPress={() => {
                                if (index !== paths.length - 1) {
                                    onNavigate(paths.slice(0, index + 1).join("/"));
                                }
                            }}
                        >
                            <Text style={app.breadcrumbText}>
                                {path}{" "}
                                {index !== paths.length - 1 && (
                                    <Ionicons name="chevron-forward-outline" color={theme.text} size={10} />
                                )}
                            </Text>
                        </Pressable>
                    ))}
                </View>
            </ScrollView>
        </View>
    );
}
