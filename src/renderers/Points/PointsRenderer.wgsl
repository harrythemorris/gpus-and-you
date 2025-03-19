struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) color: vec4f,
}

@vertex
fn vertexMain(@location(0) position: vec2f,
            @location(1) color: vec3f) -> VertexOutput {
    var output: VertexOutput;
    output.position = vec4f(position, 0, 1);
    output.color = vec4f(color, 1);
    return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
    return input.color;
}
