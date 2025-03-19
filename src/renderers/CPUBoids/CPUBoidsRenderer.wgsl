struct VertexInput {
    @location(0) position: vec2f,
    @location(1) instancePosition: vec2f,
    @location(2) instanceRotation: f32,
}

struct VertexOutput {
    @builtin(position) position: vec4f,
}

@vertex
fn vertexMain(vert: VertexInput) -> VertexOutput {
    var output: VertexOutput;
    let angle = vert.instanceRotation;
    let rotatedPos = vec2f(
        vert.position.x * cos(angle) - vert.position.y * sin(angle),
        vert.position.x * sin(angle) + vert.position.y * cos(angle)
    );
    output.position = vec4f(rotatedPos + vert.instancePosition, 0, 1);
    return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
    return vec4(0,0,0,1);
}
