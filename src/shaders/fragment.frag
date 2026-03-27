#version 130

/*
next steps:

- road
- grass
- trees
- sun glare
- better sky
- specular reflections (car surface, rained/wet road)
- ocean-view
*/

#define DEFAULT_MATERIAL_ID 0
#define CAR_MATERIAL_ID 1
#define STEERING_WHEEL_MATERIAL_ID 2
#define TERRAIN_MATERIAL_ID 3

uniform int m;
out vec4 o;
float T_MAX = 1000.0;
float PI = 3.1415926;
float t = m/float(44100);
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

float fbm(vec2 p)
{
	float v = 0.0;
	float k = 0.5;
	for (int i = 0; i < 5; ++i)
	{
		v += k*noise(p/k);
		k /= 2.0;
	}
	return v;
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
vec2 mod2(inout vec2 p, vec2 size) {
	vec2 c = floor((p + size*0.5)/size);
	p = mod(p + size*0.5,size) - size*0.5;
	return c;
}
float smin( float a, float b, float k )
{
    k *= 4.0;
    float h = max(k-abs(a-b),0.0);
    return min(a, b) - h*h*0.25/k;
}
float sp(vec3 p, float r)
{
	return length(p)-r;
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

vec2 roadPointA = vec2(0,0);
vec2 roadPointB = vec2(0, 1000);
vec2 roadPointC = vec2(2000, 2000);

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

float eval_terrain_height(vec2 p)
{
	float terrain_height = 60.0*noise(0.01*p) - 0.5;

	vec2 temp;
	float closenessToRoad = sdRoad(p, temp);
	terrain_height = mix(0.05, 1.0, smoothstep(7.0, 100.0, closenessToRoad)) * terrain_height;

	//terrain_height += 20.0*noise(0.02*p);
	//terrain_height += 10.0*noise(0.04*p);
	//terrain_height += 5.0*noise(0.1*p);
	return terrain_height;
}

vec3 eval_terrain_normal(vec2 p)
{
	vec2 e = vec2(0, 0.05);
	float center_height = eval_terrain_height(p);
	float dhdx = eval_terrain_height(p + e.yx) - center_height;
	float dhdz = eval_terrain_height(p + e.xy) - center_height;
	return normalize(cross(vec3(0, dhdz, e.y), vec3(e.y, dhdx, 0)));
}

float sdWorld(vec3 p)
{
	float terrain_height = eval_terrain_height(p.xz);
	vec2 id = mod2(p.xz, vec2(5.0, 5.0));
	p.xz += 4.0 * (hash22(id) - 0.5);
	//float dist = length(p - vec3(0, terrain_height, 0)) - 0.3;
	float dist = T_MAX;
	dist = min(dist, p.y-terrain_height);
	return dist;
}

vec3 g_origin;
mat3 g_view_rotation;

mat3 view_mat3(vec3 forward, vec3 y)
{
	vec3 x = normalize(cross(y, forward));
	vec3 z = normalize(cross(x, y));
	return transpose(mat3(x, y, z));
}

Map_Result map(vec3 p)
{
	Map_Result result;
	result.dist = T_MAX;
	result.mat_id = DEFAULT_MATERIAL_ID;
	vec3 cp = p;
	cp -= g_origin;
	cp *= transpose(g_view_rotation);
	cp -= vec3(1.2,-0.7,1.2);

	sdCarInterior(result, cp);
	update(result, sdWorld(p), TERRAIN_MATERIAL_ID);
	return result;
}

float shadow( in vec3 ro, in vec3 rd, float mint, float maxt, float w )
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
        float d = sqrt(h*h-y*y);
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

void main()
{
	vec2 res = vec2(1280,720);
	vec2 q = gl_FragCoord.xy/res.xy;
	vec2 v = -1.0+2.0*q;
	v.x *= res.x/res.y;
	g_origin = vec3(0, 1.6, -2);
	float time = t - hash12(gl_FragCoord.xy + t) / 200.0;

	vec4 track_val = bezier2(roadPointA, roadPointB, roadPointC, time/60.0);
	g_origin.xz += track_val.xy;
	g_origin.y += eval_terrain_height(g_origin.xz);
	vec3 ro = g_origin;
	ro.y += 0.01*noise(vec2(50*t, 0)); // car shake
	g_view_rotation = view_mat3(vec3(track_val.z, 0, track_val.w), eval_terrain_normal(g_origin.xz));
	vec3 rd = normalize(vec3(v.x, v.y, 1.7)) * g_view_rotation;
	float t = 0.0;

	int hit_mat_id = -1;
	for (int i = 0; i < 512 && t < T_MAX; ++i) {
		Map_Result map_res = map(ro + t * rd);
		float dist = map_res.dist;
		if (abs(dist) < 0.001*(1.0+t)) {
			hit_mat_id = map_res.mat_id;
			break;
		}
		t += dist;
	}

	vec3 sky_col = 1.4*vec3(0.5, 0.6, 0.7);
	sky_col = mix(sky_col, 0.5*sky_col, rd.y);
	vec3 col = sky_col;
	vec3 l = normalize(vec3(-0.3, 2.0, 1.0));
	if (hit_mat_id != -1)
	{
		vec3 p = ro + t * rd;
		vec3 n = normal(p);
		vec3 h = normalize(n + l);

		vec2 pInRoadCoord;
		float distToTrack = sdRoad(p.xz, pInRoadCoord);

		vec3 base_col = vec3(1);
		if (hit_mat_id == CAR_MATERIAL_ID)
			base_col = vec3(0.05);
		else if (hit_mat_id == STEERING_WHEEL_MATERIAL_ID)
			base_col = vec3(0.05);
		else if (hit_mat_id == TERRAIN_MATERIAL_ID)
		{
			base_col = vec3(0.4, 0.3, 0.2);
			if (distToTrack <= 7.0)
			{
				base_col = vec3(0.1);
				if (distToTrack <= 0.15)
				{
					float k = step(1.3, mod(pInRoadCoord.y, 5.0));
					base_col = mix(base_col, vec3(0.65), k);
				}
				if (distToTrack > 6.5)
				{
					float k = step(2.0, mod(pInRoadCoord.y, 10.0));
					base_col = mix(base_col, vec3(0.65), k);
				}
			}
		}

		float n_dot_l = max(0, dot(n, l));

		vec3 diffuse = base_col;
		float vis = shadow(p, l, 0.023, T_MAX, 0.03);
		col = diffuse * vis * n_dot_l;
		col += 0.2 * sky_col * ao(p, n, 1.5, 1.0) * base_col;
	}

	o = vec4(sqrt(col), 0.0);
}