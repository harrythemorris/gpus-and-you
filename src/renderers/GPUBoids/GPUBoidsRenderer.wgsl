struct VertexInput {
    @location(0) position: vec2f,
    @location(1) instancePosition: vec2f,
    @location(2) instanceVelocity: vec2f,
}

struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) color: vec4f,
}

@vertex
fn vertexMain(vert: VertexInput) -> VertexOutput {
    var output: VertexOutput;
    // Calc angle from the velocity
    let angle = atan2(vert.instanceVelocity.y, vert.instanceVelocity.x);

    let rotatedPos = vec2f(
        vert.position.x * cos(angle) - vert.position.y * sin(angle),
        vert.position.x * sin(angle) + vert.position.y * cos(angle)
    );
    output.position = vec4f(rotatedPos + vert.instancePosition, 0, 1);
    output.color = vec4f(0.0, 0.0, 0.0, 1.0);
    output.color = vec4f(cos(angle) * 0.5 + 0.5, sin(angle) * 0.5 + 0.5, 1.0, 1.0);

    return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
    return input.color;
}
