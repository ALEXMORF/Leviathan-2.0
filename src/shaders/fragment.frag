#version 130

/*
next steps:

- scene 3 (oceanside)
-	ocean
-	sunset lighting
- scene 4 (fog)
-	variable density fog?
- scene 5 (E-werk)
-	E-Werk building

- polish:
- all scenes:
-   car body
		steering wheel movement
		better car material
		dashboard
-	tall trees
-	short foliage/flower
- scene 1
-	house windows
- compare to actual switzerland drive-through reference footage for biggest diffs
     relist priority
- trees
- anti-alias grass textures
- better sky & clouds
- steering wheel rotate
- anti-aliasing
-    grass texture
-    lane markings
-    rounding guard-rails
- specular reflections (car surface, rained/wet road)
- ocean-view
*/

#define DEFAULT_MATERIAL_ID 0
#define CAR_MATERIAL_ID 1
#define STEERING_WHEEL_MATERIAL_ID 2
#define TERRAIN_MATERIAL_ID 3
#define GUARDRAIL_MATERIAL_ID 4
#define TREE_TRUNK_MATERIAL_ID 5
#define TREE_LEAF_MATERIAL_ID 6
#define HOUSE_BODY_MATERIAL_ID 7
#define HOUSE_ROOF_MATERIAL_ID 8

uniform int m;
out vec4 o;
float T_MAX = 10000.0;
float PI = 3.1415926;
float gTime = m/float(44100);

int sceneId = 0;
vec2 roadPointA;
vec2 roadPointB;
vec2 roadPointC;

float hash11(float p)
{
    p = fract(p * .1031);
    p *= p + 33.33;
    p *= p + p;
    return fract(p);
}
float hash12(vec2 p)
{
	vec3 p3  = fract(vec3(p.xyx) * .1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}
vec2 hash22(vec2 p)
{
	vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973));
    p3 += dot(p3, p3.yzx+33.33);
    return fract((p3.xx+p3.yz)*p3.zy);
}

float noise(vec2 p)
{
	vec2 ip = floor(p);
	vec2 fp = p - ip;
	float a = hash12(ip);
	float b = hash12(ip+vec2(1,0));
	float c = hash12(ip+vec2(0,1));
	float d = hash12(ip+vec2(1,1));
	vec2 t = smoothstep(vec2(0), vec2(1), fp);
	return mix(mix(a, b, t.x), mix(c, d, t.x), t.y);
}

mat3 rx(float a){return mat3(1.0,0.0,0.0,0.0,cos(a),-sin(a),0.0,sin(a),cos(a));}
mat3 ry(float a){return mat3(cos(a),0.0,sin(a),0.0,1.0,0.0,-sin(a),0.0,cos(a));}
mat3 rz(float a){return mat3(cos(a),-sin(a),0.0,sin(a),cos(a),0.0,0.0,0.0,1.0);}
float box(vec3 p, vec3 b)
{
	vec3 q = abs(p) - b;
	return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0);
}
float modp(inout vec2 p, float rep) {
	float angle = 2*PI/rep;
	float a = atan(p.y, p.x) + angle/2;
	float c = floor(a/angle);
	a = mod(a,angle) - angle/2.;
	p = vec2(cos(a), sin(a))*length(p);
	if (abs(c) >= (rep/2)) c = abs(c);
	return c;
}
float mod1(inout float p, float size) {
	float c = round(p/size);
	p = p - c*size;
	return c;
}
vec2 mod2(inout vec2 p, vec2 size) {
	vec2 c = round(p/size);
	p = p - c*size;
	return c;
}
float smin( float a, float b, float k )
{
    k *= 4.0;
    float h = max(k-abs(a-b),0.0);
    return min(a, b) - h*h*0.25/k;
}
float torus( vec3 p, vec2 t )
{
  vec2 q = vec2(length(p.xz)-t.x,p.y);
  return length(q)-t.y;
}
float caps(vec3 p, float r, float c){
	return mix(length(p.xz) - r, length(vec3(p.x, abs(p.y) - c, p.z)) - r, step(c, abs(p.y)));
}

struct Map_Result
{
	float dist;
	int mat_id;
};

void update(inout Map_Result result, float dist, int mat_id)
{
	if (dist < result.dist)
	{
		result.dist = dist;
		result.mat_id = mat_id;
	}
}

float sdWheel(vec3 p)
{
	p*=rx(-0.05*PI);
	float dist = torus(p*rx(0.5*PI), vec2(0.53, 0.075));
	vec3 gp = p;
	modp(gp.xy, 4.0);
	gp-=vec3(0.22,0,0);
	dist = smin(dist, box(gp, vec3(0.31, 0.05, 0.05)-0.03)-0.02, 0.008);
	dist = min(dist, box((p-vec3(0,-0.05,0.2))*rx(-0.05*PI), vec3(0.05, 0.05, 0.22)));
	return dist;
}

void sdCarInterior(inout Map_Result result, vec3 p)
{
	vec3 dp = p;
	dp.x = abs(dp.x);

	update(result, sdWheel(p - vec3(-1.1, -0.1, 0.2)), STEERING_WHEEL_MATERIAL_ID);

	// dashboard
	float sdFrame = box((p-vec3(0,-1.05,1.5))*rx(-0.05*PI), vec3(2.5, 1, 1))-0.02;
	sdFrame = smin(sdFrame, box((p-vec3(0,-0.1,1.7))*rx(-0.05*PI), vec3(2.4, 0.01, 1))-0.05, 0.02);
	// frame
	sdFrame = smin(sdFrame, box((dp-vec3(2.7,0,1.15))*rx(0.2*PI), vec3(0.1, 2.3, 0.1))-0.08, 0.05);
	sdFrame = smin(sdFrame, box(p-vec3(0,-0.7,3), vec3(3.0, 0.5, 2))-0.2, 0.01);

	float sdRoof = box(p-vec3(0,1.9,-2.0), vec3(2.1, 0.1, 2))-0.02;

	update(result, smin(sdFrame, sdRoof, 0.1), CAR_MATERIAL_ID);

	// doors
	update(result, box(dp-vec3(2.75,-2,-1), vec3(0.1, 2.0, 2.0))-0.2, CAR_MATERIAL_ID);
}

float cro( vec2 a, vec2 b ) { return a.x*b.y-a.y*b.x; }

float sdBezier( vec2 p, vec2 v0, vec2 v1, vec2 v2, out vec2 outQ )
{
	vec2 i = v0 - v2;
    vec2 j = v2 - v1;
    vec2 k = v1 - v0;
    vec2 w = j-k;

	v0-= p; v1-= p; v2-= p;
    
	float x = cro(v0, v2);
    float y = cro(v1, v0);
    float z = cro(v2, v1);

	vec2 s = 2.0*(y*j+z*k)-x*i;

    float r =  (y*z-x*x*0.25)/dot(s,s);
    float t = clamp( (0.5*x+y+r*dot(s,w))/(x+y+z),0.0,1.0);
    
    vec2 d = v0+t*(k+k+t*w);
    outQ = d + p;
	return length(d);
}

float sdRoad(vec2 p, inout vec2 pInBezierCoord)
{
	return sdBezier(p, roadPointA, roadPointB, roadPointC, pInBezierCoord);
}

float fbm(vec2 p)
{
	float y = noise(p);
	y += 0.5*noise(2.0*p);
	y += 0.25*noise(4.0*p);
	y += 0.125*noise(8.0*p);
	y += 0.0625*noise(16.0*p);
	y += 0.03125*noise(32.0*p);
	return y;
}

float eval_terrain_height(vec2 p, float distToRoad)
{
	float roadHeight = 0;
	float amp = 0.0;
	float freq = 1.0;

	if (sceneId == 0)
	{
		amp = 10.;
		freq = 0.01;
	}
	if (sceneId == 1)
	{
		amp = 800.0;
		freq = 0.0003;
		roadHeight = 800.0;
	}

	float terrain_height = amp*fbm(freq*p);

	float roadToTerrainW = mix(0.001, 1.0, smoothstep(7.0, 200.0, distToRoad));
	terrain_height = mix(roadHeight, terrain_height, roadToTerrainW);

	return terrain_height;
}

vec3 eval_terrain_normal(vec2 p)
{
	vec2 e = vec2(0, 0.05);
	vec2 temp;
	float center_height = eval_terrain_height(p, sdRoad(p, temp));
	float dhdx = eval_terrain_height(p + e.yx, sdRoad(p+e.yx, temp)) - center_height;
	float dhdz = eval_terrain_height(p + e.xy, sdRoad(p+e.xy, temp)) - center_height;
	return normalize(cross(vec3(0, dhdz, e.y), vec3(e.y, dhdx, 0)));
}

vec3 g_origin;
mat3 g_view_rotation;

mat3 view_mat3(vec3 forward, vec3 y)
{
	vec3 x = normalize(cross(y, forward));
	vec3 z = normalize(cross(x, y));
	return transpose(mat3(x, y, z));
}

// Standard 2D rotation matrix used to bend and twist space
mat2 rotate2D(float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return mat2(c, s, -s, c);
}

// Distance Estimator for a 3D Fractal Tree
void sdTree(inout Map_Result result, vec3 p, float tree_scale) {
	p /= tree_scale;

    // 2. Initialize the distance field
    // Setting 'e' (closest distance) to p.y creates an infinite flat ground plane at y = 0
    float closestDist = T_MAX;
    
    // 3. Initialize the branch scale factor
    float scale = 1.0;

	int mat_id = TREE_TRUNK_MATERIAL_ID;

    // 4. Fractal Iteration Loop
    // Continue drawing smaller branches until the scale drops below 0.01
    while(scale > 0.01) {
        // A. Domain Repetition / Folding
        // Taking the absolute value of X mirrors the space along the X-axis. 
        // This is what causes the tree to branch out left and right at every step.
        p.x = abs(p.x);
        
        // B. Shape Generation: Capped Cylinder (The Branch)
        // length(p.xz) gives us an infinite vertical cylinder.
        // abs(p.y - scale * 0.5) - scale * 0.4 creates flat top and bottom bounds.
        // The max() function intersects them, giving us a finite branch.
        // Subtracting (scale * 0.1) inflates it slightly, rounding the hard edges.
        float branchDist = max(abs(p.y - scale * 0.5) - scale * 0.4, length(p.xz)) - scale * 0.1;
        
        // C. Boolean Union
        // min() combines our new branch with the rest of the tree and ground plane.
		if (branchDist < closestDist)
		{
			closestDist = branchDist;
			mat_id = (scale > 0.03)? TREE_TRUNK_MATERIAL_ID: TREE_LEAF_MATERIAL_ID;
		}
        
        // D. Translation
        // Move our coordinate system to the tip of the current branch
        // so the next iteration builds on top of it.
        p.y -= scale;
        
        // E. Rotation
        // Twist the space around the Y-axis (Yaw)
        p.xz *= rotate2D(1.6); 
        // Bend the space outward/forward around the X-axis (Pitch)
        p.zy *= rotate2D(0.7); 
        
        // F. Scaling
        // Shrink the scale by 23% for the next set of branches.
        scale *= 0.76;
    }
    
    // 5. The Fudge Factor
    // Multiplying the final distance by 0.8 acts as a safety margin. 
    // Because mirroring and non-uniform rotation distorts the perfect distance field, 
    // raymarchers can sometimes overstep and clip through the surface. 
    // *0.8 forces the ray to take slightly smaller steps.
	float dist = tree_scale*(closestDist * 0.8);
    if (dist < result.dist)
	{
		result.dist = dist;
		result.mat_id = mat_id;
	}
}

void sdForest(inout Map_Result result, vec3 p, float distToRoad, float terrain_height, vec2 tileDim)
{
	// trees
	if (distToRoad >= 30.0)
	{
		for (int i = 0; i < 1; ++i)
		{
			for (int j = 0; j < 1; ++j)
			{
				vec3 tp = p;
				tp.xz += vec2(i,j)*tileDim;
				vec2 id = mod2(tp.xz, tileDim*2.0);
				float rand = hash12(id);
				if (rand < 0.5)
				{
					tp.xz += tileDim * (hash22(id) - 0.5);
					tp *= ry(2.0*PI*rand);
					sdTree(result, (tp - vec3(0, terrain_height, 0)), 3.0 + 2.0*rand);
				}
			}
		}
	}
}

void sdHouse(inout Map_Result result, vec3 p, vec3 dim)
{
	float body = box(p, dim) - 0.01;
	//body = max(body, -box(p-vec3(0,0,-10), vec3(0.5,0.8,0.1)));
	update(result, body, HOUSE_BODY_MATERIAL_ID);

	vec3 rp = p-vec3(0,dim.y+6.0,0);
	rp.x = abs(rp.x);
	rp *= rz(PI/6);
	float roof = box(rp, vec3(dim.x+2.5, 0.5, dim.z+0.5)) - 0.01;
	update(result, roof, HOUSE_ROOF_MATERIAL_ID);
}

void sdWorld(inout Map_Result result, vec3 p)
{
	vec2 pInRoadSpace;
	float distToRoad = sdRoad(p.xz, pInRoadSpace);
	float terrain_height = eval_terrain_height(p.xz, distToRoad);

	if (sceneId != 0)
	{

	// guard rails
	update(result, max(abs(7.2-distToRoad)-0.13+0.03*pow(cos(10.0*p.y), 2.0),
	                   abs(p.y-0.6-terrain_height)-0.2), GUARDRAIL_MATERIAL_ID);
	vec3 gp = vec3(7.2-distToRoad, p.y, mod(pInRoadSpace.y+1.5, 3.0)-1.5);
	update(result, box(gp, vec3(0.1, 0.6, 0.2)), GUARDRAIL_MATERIAL_ID);
	}

	if (sceneId == 0)
	{
		{
			vec3 hp = p;
			hp.x = abs(hp.x);
			hp.x -= 35.0;
			float houseId = mod1(hp.z, 40.0);
			float rand = hash11(houseId);
			float rand2 = hash11(houseId+37.2);
			hp.y -= terrain_height + 3.5;
			hp *= ry(0.5*PI);
			sdHouse(result, hp, vec3(10.0, 4.5 + 10.*rand, 10.0+10.0*rand2));
		}
		sdForest(result, p, distToRoad+25.0, terrain_height, vec2(30.0));
	}
	else if (sceneId == 1)
	{
		sdForest(result, p, distToRoad, terrain_height, vec2(5.0));
	}

	// terrain
	update(result, (p.y-terrain_height), TERRAIN_MATERIAL_ID);
}

Map_Result map(vec3 p)
{
	Map_Result result;
	result.dist = T_MAX;
	result.mat_id = DEFAULT_MATERIAL_ID;

	vec3 cp = p;
	cp -= g_origin;
#if 1
	cp *= transpose(g_view_rotation);
	cp -= vec3(1.2,-0.7,1.2);
	sdCarInterior(result, cp);
	sdWorld(result, p);
#else
	//sdTree(result, cp-vec3(0,-0.1,1));
	sdHouse(result, cp-vec3(0,0,28));
#endif
	return result;
}

float calc_shadow( in vec3 ro, in vec3 rd, float mint, float maxt, float w )
{
    float res = 1.0;
    float ph = 1e20;
    float t = mint;
    for( int i=0; i<256 && t<maxt; i++ )
    {
        float h = map(ro + rd*t).dist;
        if( h<0.001 )
            return 0.0;
        float y = h*h/(2.0*ph);
        //float d = sqrt(h*h-y*y);
        float d = sqrt(abs(h*h-y*y)); // clamp above 0 to avoid NaN
        res = min( res, d/(w*max(0.0,t-y)) );
        ph = h;
        t += h;
    }
    return res;
}
vec3 rhs(vec3 dir, float i)
{
	vec2 rnd = vec2(hash11(i+1.), hash11(i+2.));
	float s = rnd.x*PI*2.;
	float t = rnd.y*2.-1.;
	vec3 v = vec3(sin(s), cos(s), t) / sqrt(1.0 + t * t);
	return v * sign(dot(v, dir));
}
float ao( vec3 p, vec3 n, float maxDist, float falloff)
{
	float ao = 0.0;
	for( int i=0; i<10; i++ )
	{
		float l = hash11(float(i))*maxDist;
		vec3 rd = normalize(n+rhs(n, l )*0.95)*l;
		ao += (l - map( p + rd ).dist) / pow(1.+l, falloff);
	}
	return clamp(1.-ao*0.1,0.0,999.0);
}
vec3 normal( vec3 p )
{
	vec3 eps = vec3(0.001, 0.0, 0.0);
	return normalize( vec3(
		map(p+eps.xyy).dist-map(p-eps.xyy).dist,
		map(p+eps.yxy).dist-map(p-eps.yxy).dist,
		map(p+eps.yyx).dist-map(p-eps.yyx).dist
	));
}

vec4 bezier2(vec2 p0, vec2 p1, vec2 p2, float t)
{
	vec4 res;
	float k = 1.0 - t;
	res.xy = k*k*p0 + 2*k*t*p1 + t*t*p2; // value
	res.zw = (2*t - 2)*p0 + (2 - 4*t)*p1 + 2*t*p2; // derivative
	return res;
}

vec3 fresnel(vec3 f0, float cos_theta)
{
	return f0 + (vec3(1) - f0) * pow(1.0 - cos_theta, 5);
}

vec2 voronoi(vec2 uv)
{
    // Use time to warp the space
    vec2 f = fract(uv);
    vec2 u = floor(uv);
    
    float closest = 100.0;
    float id = 0.0;
    for (int y = -1; y <= 1; y++)
    {
        for (int x = -1; x <= 1; x++)
        {
            vec2 d = vec2(float(x), float(y));
            vec2 nu = u + d;
            vec2 p = hash22(nu);
            float dist = distance(f, p + d);
            if (dist < closest)
            {
                closest = dist;
                id = hash12(nu);
            }
        }
    }
    return vec2(max(0.0, 1.0 - closest), id);
}

float calcAO(vec3 p, vec3 n, float stepSize)
{
    float res = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 5; ++i)
    {
        float t = stepSize*float(i+1);
        vec3 sampleP = p + t * n;
        float dist = map(sampleP).dist;
        res += amp * (dist / t);
        amp /= 2.0;
        stepSize *= 2.0;
    }
    return res;
}

void main()
{
	vec2 res = vec2(1920,1080);
	vec2 q = gl_FragCoord.xy/res.xy;
	vec2 v = -1.0+2.0*q;
	v.x *= res.x/res.y;
	g_origin = vec3(0, 1.6, -2);
	float time = gTime - 1.0*hash12(gl_FragCoord.xy + gTime) / 200.0; // motion blur

	float initialDelayTime = 1.5;

	if (gTime < 12.5)
	{
		sceneId = 0;
		roadPointA = vec2(0,0);
		roadPointB = vec2(0, 500);
		roadPointC = vec2(1, 1000);
	}
	else
	{
		sceneId = 1;
		roadPointA = vec2(0,0);
		roadPointB = 1.0*vec2(0, 1000);
		roadPointC = 1.0*vec2(1500, 2000);
	}

	vec4 track_val = bezier2(roadPointA, roadPointB, roadPointC, time/30.0);
	g_origin.xz += track_val.xy;

	vec2 temp;
	g_origin.y += eval_terrain_height(g_origin.xz, sdRoad(g_origin.xz, temp));

	// nudge car to be on the right lane
	vec3 track_side_dir = normalize(cross(vec3(track_val.z, 0, track_val.w), eval_terrain_normal(g_origin.xz)));
	g_origin -= 2.0 * track_side_dir;

	vec3 ro = g_origin;
	ro.y += 0.01*noise(vec2(50*gTime, 0)); // car shake
	g_view_rotation = view_mat3(vec3(track_val.z, 0, track_val.w), eval_terrain_normal(g_origin.xz));
	vec3 rd = normalize(vec3(v.x, v.y, 1.7)) * g_view_rotation;
	float t = 0.0;

	int hit_mat_id = -1;
	for (int i = 0; i < 1024 && t < T_MAX; ++i) {
		Map_Result map_res = map(ro + t * rd);
		float dist = map_res.dist;
		if (abs(dist) < 0.001*(1.0+t)) {
			hit_mat_id = map_res.mat_id;
			break;
		}
		t += dist;
	}

	vec3 sun_col = vec3(1.1, 1.05, 1.0);

	vec3 sky_hi_col = 1.2*vec3(0.5, 0.6, 0.7);
	vec3 sky_lo_col = vec3(0.0, 0.1, 0.3);
	vec3 sky_avg_col = mix(sky_lo_col, sky_hi_col, 0.5);
	vec3 sky_col = mix(sky_lo_col, sky_hi_col, exp(-5.0*max(0,rd.y)));

	vec3 col = sky_col;
	vec3 l = normalize(vec3(-0.3, 2.0, 1.0));
	//vec3 l = normalize(vec3(-0.3, 1.0, -1.0));
	if (hit_mat_id != -1)
	{
		vec3 p = ro + t * rd;
		vec3 n = normal(p);
		vec3 h = normalize(n + l);

		vec2 pInRoadCoord;
		float distToTrack = sdRoad(p.xz, pInRoadCoord);

		bool reflective = false;
		vec3 base_col = vec3(1);
		if (hit_mat_id == CAR_MATERIAL_ID)
			base_col = vec3(0.05);
		if (hit_mat_id == STEERING_WHEEL_MATERIAL_ID)
			base_col = vec3(0.05);
		if (hit_mat_id == TREE_TRUNK_MATERIAL_ID)
			base_col = 0.7*vec3(0.13, 0.1, 0.05);
		if (hit_mat_id == TREE_LEAF_MATERIAL_ID)
			base_col = 0.7*vec3(0.3, 0.4, 0.05);
		if (hit_mat_id == HOUSE_BODY_MATERIAL_ID)
			base_col = 4.0*vec3(0.8, 0.7, 0.35);
		if (hit_mat_id == HOUSE_ROOF_MATERIAL_ID)
			base_col = vec3(0.5, 0.18, 0.1);
		if (hit_mat_id == TERRAIN_MATERIAL_ID)
		{
			if (distToTrack <= 7.0)
			{
				float rand = noise(20.0*p.xz);
				//n = normalize(n + 0.3*vec3(-0.5 + rand, 0, -0.5 + rand));
				base_col = vec3(0.1) + rand*vec3(0.05);
				if (distToTrack <= 0.15)
				{
					float k = step(1.3, mod(pInRoadCoord.y, 5.0));
					base_col = mix(base_col, vec3(0.65), k);
				}
				if (distToTrack > 6.3 && distToTrack < 6.6)
				{
					base_col = vec3(0.65);
				}

				reflective = true;
			}
			else
			{
				vec3 young_grass_col = 0.7*vec3(0.35, 0.5, 0.05);
				vec3 old_grass_col = 0.7*vec3(0.45, 0.5, 0.05);
				vec3 grass_col = mix(young_grass_col, old_grass_col, noise(0.02*p.xz));
				grass_col = mix(0.3*grass_col, grass_col, voronoi(2.0*p.xz).x);
				float fresnel = pow(clamp(1.0 + dot(n, rd), 0.0, 1.0), 3.0);
				grass_col += vec3(0.2, 0.2, 0.1) * fresnel;
				grass_col *= 0.8;
				base_col = grass_col;
			}
		}

		float n_dot_l = max(0, dot(n, l));

		col = base_col * n_dot_l * sun_col * calc_shadow(p+0.001*n, l, 0.023, T_MAX, 0.03);
		col += 0.15 * base_col * sky_avg_col * ao(p, n, 1.5, 1.0);
		//col += 0.15 * base_col * sky_col * calcAO(p+0.001*n, n, 0.2);
		if (reflective)
		{
			col += 0.2 * sky_col * pow(clamp(1.0 + dot(n, rd), 0.0, 1.0), 10.0);
		}

		if (hit_mat_id > STEERING_WHEEL_MATERIAL_ID)
		{
			float terrain_height = eval_terrain_height(p.xz, distToTrack);
			float bounce_strength = 1.0 / (1.0 + pow(p.y - terrain_height, 2.0));
			bounce_strength *= max(0.0, 0.5-0.5*n.y);
			bounce_strength *= ao(p, n, 1.5, 1.0);
			col += 0.2 * sun_col * vec3(0.3, 0.5, 0.1) * bounce_strength;
		}

		float toward_sun = pow(max(0, dot(rd, l)), 3.0);

		// fog
		col = mix(col, mix(sky_col, sun_col, toward_sun), 1.0-exp(-0.00005*t));
		// glare
		col += 0.1 * sun_col * toward_sun;
	}
	else
	{
		// cloud
		float cloudHeight = 5000.0 - 2000.0*dot(rd.xz, rd.xz);
 		vec3 skyP = ro + rd*(cloudHeight/rd.y);
		col = mix(col, vec3(1), max(0, fbm(0.0002*skyP.xz)-1.2));
	}

	if (gTime < initialDelayTime)
	{
		col = vec3(0);
	}

	//col = mix(col, smoothstep(vec3(0.0), vec3(1.0), col), 0.6);
	o = vec4(sqrt(col), 0.0);
}