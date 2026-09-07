import { PropsWithChildren } from "react"
import { ImageBackground } from "react-native"

// componente para el fondo de pantalla
export default function Background(props: PropsWithChildren<{ type?: string, opacity?: number }>) {
    // si se recibe un tipo de background
    if (props.type) {
        if (props.type === "nav") {
            return (
                <ImageBackground resizeMode="cover" imageStyle={{ opacity: 0.1 }} source={require("../../assets/images/backNav.jpg")} style={{ flex: 1 }}>
                    {props.children}
                </ImageBackground>)
        }
        if (props.type === "tab") {
            return (
                <ImageBackground resizeMode="stretch" imageStyle={{ opacity: 0.2 }} source={require("../../assets/images/backTab.jpg")} style={{ }}>
                    {props.children}
                </ImageBackground>)
        }
    }
    // sino por defecto usara este background
    return (
        <ImageBackground resizeMode="cover" imageStyle={{ opacity: 0.2 }} source={require("../../assets/images/background.jpg")} style={{ flex: 1 }}>
            {props.children}
        </ImageBackground>)
}