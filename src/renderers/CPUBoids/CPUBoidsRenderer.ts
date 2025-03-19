import { BaseRenderer } from "../Base/BaseRenderer";
import Shader from "./CPUBoidsRenderer.wgsl" with { type: "text" };

const RENDER_SCALE = 0.004;
const SIM_SCALE = 0.1;

export class CPUBoidsRenderer extends BaseRenderer {
    device!: GPUDevice;
    context!: GPUCanvasContext;
    clearColor: [number, number, number, number] = [0.93, 0.99, 0.13, 1];
    pipeline!: GPURenderPipeline;
    vertexBuffer!: GPUBuffer;
    instanceBuffer!: GPUBuffer;
    numInstances: number = 500;

    // Boid parameters
    boids: Array<{
        pos: [number, number];
        vel: [number, number];
        rot: number;
    }> = [];
    cohesionRadius: number = 0.3 * SIM_SCALE;
    alignmentRadius: number = 0.2 * SIM_SCALE;
    separationRadius: number = 0.1 * SIM_SCALE;
    cohesionWeight: number = 0.01;
    alignmentWeight: number = 0.05;
    separationWeight: number = 0.05;
    maxSpeed: number = 0.01 * SIM_SCALE;

    constructor(canvas: HTMLCanvasElement) {
        super(canvas);
    }

    async init() {
        if (!navigator.gpu) {
            throw new Error("WebGPU not supported");
        }

        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
            throw new Error("No adapter found");
        }

        this.device = await adapter.requestDevice();

        const context = this.canvas.getContext("webgpu");

        if (!context) {
            throw new Error("WebGPU context not available");
        }

        this.context = context;

        const format = navigator.gpu.getPreferredCanvasFormat();
        this.context.configure({
            device: this.device,
            format: format,
            alphaMode: "premultiplied",
        });

        // Create the shader
        const shader = this.device.createShaderModule({
            code: Shader,
        });

        // Create pipeline
        this.pipeline = this.device.createRenderPipeline({
            layout: "auto",
            vertex: {
                module: shader,
                entryPoint: "vertexMain",
                buffers: [
                    {
                        // Triangle vertices
                        arrayStride: 8, // 2 floats for position * 4 bytes
                        attributes: [
                            {
                                shaderLocation: 0,
                                offset: 0,
                                format: "float32x2",
                            },
                        ],
                        stepMode: "vertex",
                    },
                    {
                        // Instance data
                        arrayStride: 12, // 2 floats position + 1 float rotation * 4 bytes
                        attributes: [
                            {
                                shaderLocation: 1,
                                offset: 0,
                                format: "float32x2", // position
                            },
                            {
                                shaderLocation: 2,
                                offset: 8,
                                format: "float32", // rotation
                            },
                        ],
                        stepMode: "instance",
                    },
                ],
            },
            fragment: {
                module: shader,
                entryPoint: "fragmentMain",
                targets: [
                    {
                        format,
                    },
                ],
            },
            primitive: {
                topology: "triangle-list",
            },
        });

        // Create triangle vertices
        const vertices = new Float32Array([
            0.0,
            RENDER_SCALE, // top
            -RENDER_SCALE,
            -RENDER_SCALE, // bottom left
            RENDER_SCALE,
            -RENDER_SCALE, // bottom right
        ]);

        this.vertexBuffer = this.device.createBuffer({
            size: vertices.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });

        this.device.queue.writeBuffer(this.vertexBuffer, 0, vertices);

        // Initialize boids
        for (let i = 0; i < this.numInstances; i++) {
            this.boids.push({
                pos: [Math.random() * 2 - 1, Math.random() * 2 - 1],
                vel: [Math.random() * 0.02 - 0.01, Math.random() * 0.02 - 0.01],
                rot: Math.random() * Math.PI * 2,
            });
        }

        // Create instance buffer
        const instanceData = new Float32Array(this.numInstances * 3);
        this.updateInstanceBuffer(instanceData);

        this.instanceBuffer = this.device.createBuffer({
            size: instanceData.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });

        this.device.queue.writeBuffer(this.instanceBuffer, 0, instanceData);
    }

    destroy() {
        this.device?.destroy();
    }

    update() {
        // Update boids
        for (let i = 0; i < this.boids.length; i++) {
            const boid = this.boids[i];

            let cohesion: [number, number] = [0, 0];
            let alignment: [number, number] = [0, 0];
            let separation: [number, number] = [0, 0];
            let cohesionCount = 0;
            let alignmentCount = 0;
            let separationCount = 0;

            // Calculate forces from other boids
            for (let j = 0; j < this.boids.length; j++) {
                if (i === j) continue;

                const other = this.boids[j];
                const dx = other.pos[0] - boid.pos[0];
                const dy = other.pos[1] - boid.pos[1];
                const distSq = dx * dx + dy * dy;

                // Cohesion
                if (distSq < this.cohesionRadius * this.cohesionRadius) {
                    cohesion[0] += other.pos[0];
                    cohesion[1] += other.pos[1];
                    cohesionCount++;
                }

                // Alignment
                if (distSq < this.alignmentRadius * this.alignmentRadius) {
                    alignment[0] += other.vel[0];
                    alignment[1] += other.vel[1];
                    alignmentCount++;
                }

                // Separation
                if (distSq < this.separationRadius * this.separationRadius) {
                    const factor = 1 / Math.max(distSq, 0.0001);
                    separation[0] -= dx * factor;
                    separation[1] -= dy * factor;
                    separationCount++;
                }
            }

            // Apply forces
            if (cohesionCount > 0) {
                // Calculate the center of cohesion and weight it
                cohesion[0] =
                    (cohesion[0] / cohesionCount - boid.pos[0]) *
                    this.cohesionWeight;
                cohesion[1] =
                    (cohesion[1] / cohesionCount - boid.pos[1]) *
                    this.cohesionWeight;
                boid.vel[0] += cohesion[0] * this.cohesionWeight;
                boid.vel[1] += cohesion[1] * this.cohesionWeight;
            }

            if (alignmentCount > 0) {
                // Average and weight the alignment
                alignment[0] =
                    (alignment[0] / alignmentCount) * this.alignmentWeight;
                alignment[1] =
                    (alignment[1] / alignmentCount) * this.alignmentWeight;
                boid.vel[0] += alignment[0];
                boid.vel[1] += alignment[1];
            }

            if (separationCount > 0) {
                boid.vel[0] += separation[0] * this.separationWeight;
                boid.vel[1] += separation[1] * this.separationWeight;
            }

            // Limit speed
            const speed = Math.sqrt(
                boid.vel[0] * boid.vel[0] + boid.vel[1] * boid.vel[1],
            );
            if (speed > this.maxSpeed) {
                boid.vel[0] = (boid.vel[0] / speed) * this.maxSpeed;
                boid.vel[1] = (boid.vel[1] / speed) * this.maxSpeed;
            }

            // Update position
            boid.pos[0] += boid.vel[0];
            boid.pos[1] += boid.vel[1];

            // Wrap around edges
            if (boid.pos[0] > 1) boid.pos[0] = -1;
            if (boid.pos[0] < -1) boid.pos[0] = 1;
            if (boid.pos[1] > 1) boid.pos[1] = -1;
            if (boid.pos[1] < -1) boid.pos[1] = 1;

            // Update rotation to match velocity
            boid.rot = Math.atan2(boid.vel[1], boid.vel[0]) + Math.PI / 2;
        }

        // Update instance buffer
        const instanceData = new Float32Array(this.numInstances * 3);
        this.updateInstanceBuffer(instanceData);
        this.device.queue.writeBuffer(this.instanceBuffer, 0, instanceData);
    }

    updateInstanceBuffer(instanceData: Float32Array) {
        for (let i = 0; i < this.boids.length; i++) {
            const baseIndex = i * 3;
            instanceData[baseIndex] = this.boids[i].pos[0];
            instanceData[baseIndex + 1] = this.boids[i].pos[1];
            instanceData[baseIndex + 2] = this.boids[i].rot;
        }
    }

    draw() {
        const commandEncoder = this.device.createCommandEncoder();
        const textureView = this.context.getCurrentTexture().createView();

        const renderPassDescriptor: GPURenderPassDescriptor = {
            colorAttachments: [
                {
                    view: textureView,
                    clearValue: this.clearColor,
                    loadOp: "clear",
                    storeOp: "store",
                },
            ],
        };

        const passEncoder =
            commandEncoder.beginRenderPass(renderPassDescriptor);
        passEncoder.setPipeline(this.pipeline);
        passEncoder.setVertexBuffer(0, this.vertexBuffer);
        passEncoder.setVertexBuffer(1, this.instanceBuffer);
        passEncoder.draw(3, this.numInstances);
        passEncoder.end();

        this.device.queue.submit([commandEncoder.finish()]);
    }
}
