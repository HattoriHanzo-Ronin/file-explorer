import { PropsWithChildren } from "react";
import { ImageBackground } from "react-native";
import { background } from "../styles/components/style";

export default function Background(props: PropsWithChildren<{ type?: "nav" | "tab" }>) {
    const { type, children } = props;

    if (type) {
        if (type === "nav") {
            return (
                <ImageBackground
                    resizeMode="cover"
                    imageStyle={background.navImage}
                    source={require("../../assets/images/back-nav.jpg")}
                    style={background.parent}
                >
                    {children}
                </ImageBackground>
            );
        }

        if (type === "tab") {
            return (
                <ImageBackground
                    resizeMode="stretch"
                    imageStyle={background.image}
                    source={require("../../assets/images/back-tab.jpg")}
                >
                    {children}
                </ImageBackground>
            );
        }
    }

    return (
        <ImageBackground
            resizeMode="cover"
            imageStyle={background.image}
            source={require("../../assets/images/background.jpg")}
            style={background.parent}
        >
            {children}
        </ImageBackground>
    );
}
