import "./index.css";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import {
    WebGPUInitRenderer,
    HelloWorldRenderer,
    PointsRenderer,
    InstancingRenderer,
    CPUBoidsRenderer,
    GPUBoidsRenderer,
} from "./renderers";

const renderers = [
    WebGPUInitRenderer,
    HelloWorldRenderer,
    PointsRenderer,
    InstancingRenderer,
    CPUBoidsRenderer,
    GPUBoidsRenderer,
] as const;

export function App() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [searchParams, setSearchParams] = useSearchParams();
    const selectedRenderer = parseInt(searchParams.get("renderer") || "0");
    const [fps, setFps] = useState(0);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) {
            return;
        }

        canvas.width = canvas.offsetWidth * window.devicePixelRatio;
        canvas.height = canvas.offsetHeight * window.devicePixelRatio;

        const renderer = new renderers[selectedRenderer](canvas);
        let running = true;
        let frameCount = 0;
        let lastTime = performance.now();

        renderer.init().then(() => {
            if (!running) {
                renderer.destroy();
            }

            const update = () => {
                const currentTime = performance.now();
                frameCount++;

                if (currentTime - lastTime >= 1000) {
                    setFps(frameCount);
                    frameCount = 0;
                    lastTime = currentTime;
                }

                renderer.update();
                renderer.draw();

                if (running) {
                    requestAnimationFrame(update);
                }
            };

            update();
        });

        return () => {
            running = false;
            renderer.destroy();
        };
    }, [selectedRenderer]);

    return (
        <div className="app">
            <ul className="nav">
                <li onClick={() => setSearchParams({ renderer: "0" })}>
                    1. INIT
                </li>
                <li onClick={() => setSearchParams({ renderer: "1" })}>
                    2. HELLO WORLD
                </li>
                <li onClick={() => setSearchParams({ renderer: "2" })}>
                    3. POINTS
                </li>
                <li onClick={() => setSearchParams({ renderer: "3" })}>
                    4. INSTANCING
                </li>
                <li onClick={() => setSearchParams({ renderer: "4" })}>
                    5. CPU BOIDS
                </li>
                <li onClick={() => setSearchParams({ renderer: "5" })}>
                    6. GPU BOIDS
                </li>
            </ul>
            <div className="renderer">
                <div className="fps">{fps}fps</div>
                <canvas ref={canvasRef} />
            </div>
        </div>
    );
}

export default App;
