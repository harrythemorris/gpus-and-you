import "./index.css";
import { useEffect, useRef } from "react";
import { GPUBoidsRenderer } from "./renderers";

export function App() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) {
            return;
        }

        canvas.width = canvas.offsetWidth * window.devicePixelRatio;
        canvas.height = canvas.offsetHeight * window.devicePixelRatio;

        const renderer = new GPUBoidsRenderer(canvas);
        let running = true;

        renderer.init().then(() => {
            if (!running) {
                renderer.destroy();
            }

            console.log("Initialized");
            const update = () => {
                renderer.update();
                renderer.draw();

                if (running) {
                    requestAnimationFrame(update);
                }
            };

            update();
        });

        return () => {
            console.log("destroying");
            running = false;
            renderer.destroy();
        };
    }, []);

    return (
        <div className="app">
            <ul className="nav">
                <li>1. INIT</li>
                <li>2. HELLO WORLD</li>
                <li>3. POINTS</li>
                <li>4. BOIDS</li>
            </ul>
            <canvas ref={canvasRef} />
        </div>
    );
}

export default App;
