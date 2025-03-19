 struct Config {
     cohesionRadius: f32,
     alignmentRadius: f32,
     separationRadius: f32,
     cohesionWeight: f32,
     alignmentWeight: f32,
     separationWeight: f32,
     maxSpeed: f32,
 }

 struct Boid {
     position: vec2f,
     velocity: vec2f,
 }

 struct Boids {
     boids: array<Boid>,
 }

 @group(0) @binding(0) var<storage, read> boidInput: Boids;
 @group(0) @binding(1) var<storage, read_write> boidOutput: Boids;
 @group(0) @binding(2) var<uniform> config: Config;

 fn normalize_safe(v: vec2f) -> vec2f {
     let len = length(v);
     if (len > 0.0) {
         return v / len;
     }
     return vec2f(0.1, 0.1); // Return a non-zero vector with both components
 }

 @compute @workgroup_size(256)
 fn computeMain(@builtin(global_invocation_id) global_id: vec3u) {
     let i = global_id.x;
     if (i >= arrayLength(&boidInput.boids)) {
         return;
     }

     let currentBoid = boidInput.boids[i];
     var cohesionSum = vec2f(0.0);
     var alignmentSum = vec2f(0.0);
     var separationSum = vec2f(0.0);
     var cohesionCount = 0;
     var alignmentCount = 0;
     var separationCount = 0;

     for (var j = 0u; j < arrayLength(&boidInput.boids); j++) {
         if (j == i) {
             continue;
         }

         let otherBoid = boidInput.boids[j];
         let diff = otherBoid.position - currentBoid.position;
         let dist = length(diff);

         if (dist < config.cohesionRadius) {
             cohesionSum += otherBoid.position;
             cohesionCount++;
         }
         if (dist < config.alignmentRadius) {
             alignmentSum += otherBoid.velocity;
             alignmentCount++;
         }
         if (dist < config.separationRadius) {
            let factor = 1 / max(dist, 0.0001);
            separationSum -= diff * factor;
            separationCount++;
         }
     }

     var newVelocity = currentBoid.velocity;

     if (cohesionCount > 0) {
         let cohesionCenter = (cohesionSum / f32(cohesionCount) - currentBoid.position);
         newVelocity += normalize(cohesionCenter) * config.cohesionWeight;
     }
     if (alignmentCount > 0) {
         let avgVelocity = alignmentSum / f32(alignmentCount);
         newVelocity += normalize(avgVelocity) * config.alignmentWeight;
     }
     if (separationCount > 0) {
         newVelocity += normalize(separationSum) * config.separationWeight;
     }

     // Limit speed
     let speed = length(newVelocity);
     if (speed > config.maxSpeed) {
         newVelocity = normalize(newVelocity) * config.maxSpeed;
     }

     let minSpeed = config.maxSpeed * 0.5;
     if (speed < minSpeed) {
         newVelocity = normalize_safe(newVelocity) * minSpeed;
     }

     // Update position
     var newPosition = currentBoid.position + newVelocity;

     // Wrap around edges
     if (newPosition.x > 1.0) { newPosition.x = -1.0; }
     if (newPosition.x < -1.0) { newPosition.x = 1.0; }
     if (newPosition.y > 1.0) { newPosition.y = -1.0; }
     if (newPosition.y < -1.0) { newPosition.y = 1.0; }

     boidOutput.boids[i] = Boid(newPosition, newVelocity);
 }
