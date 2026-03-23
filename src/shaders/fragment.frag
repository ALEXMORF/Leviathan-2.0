#version 130
uniform int m;
out vec4 o;
float T_MAX = 100.0;
float PI = 3.1415926;
float t = m/float(44100);
float hash(float c){return fract(sin(dot(c, 12.9898)) * 43758.5453);}
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

float sdCarInterior(vec3 p)
{
	vec3 dp = p;
	dp.x = abs(dp.x);

	float dist = sdWheel(p - vec3(-1.1, -0.1, 0.2));

	// dashboard
	float sdFrame = box((p-vec3(0,-1.05,1.5))*rx(-0.05*PI), vec3(2.5, 1, 1))-0.02;
	sdFrame = smin(sdFrame, box((p-vec3(0,-0.1,1.7))*rx(-0.05*PI), vec3(2.4, 0.01, 1))-0.1, 0.02);
	// frame
	sdFrame = smin(sdFrame, box((dp-vec3(2.7,0,1.15))*rx(0.2*PI), vec3(0.1, 2.3, 0.1))-0.08, 0.05);
	sdFrame = smin(sdFrame, box(p-vec3(0,-0.7,3), vec3(3.0, 0.5, 2))-0.2, 0.01);

	float sdRoof = box(p-vec3(0,1.9,-2.0), vec3(2.1, 0.1, 2))-0.02;

	dist = min(dist, smin(sdFrame, sdRoof, 0.1));

	// doors
	dist = min(dist, box(dp-vec3(2.75,-2,-1), vec3(0.1, 2.0, 2.0))-0.2);

	return dist;
}

float sdWorld(vec3 p)
{
	vec2 id = mod2(p.xz, vec2(5.0, 5.0));
	if (id.x == 0) {
		return 5.0;
	}
	p.xz += 2.0 * vec2(hash(dot(id.x, id.y)), hash(3.7+dot(id.y, id.x)));
	return length(p - vec3(0, 0, 0)) - 0.3;
}

float map(vec3 p)
{
	float dist = sdCarInterior(p - vec3(1.2,0.7,-0.8));
	dist = min(dist, p.y);
	dist = min(dist, sdWorld(p - vec3(0, 0, -30.0*t)));
	return dist;
}
float shadow( in vec3 ro, in vec3 rd, float mint, float maxt, float w )
{
    float res = 1.0;
    float ph = 1e20;
    float t = mint;
    for( int i=0; i<256 && t<maxt; i++ )
    {
        float h = map(ro + rd*t);
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
	vec2 rnd = vec2(hash(i+1.), hash(i+2.));
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
		float l = hash(float(i))*maxDist;
		vec3 rd = normalize(n+rhs(n, l )*0.95)*l;
		ao += (l - map( p + rd )) / pow(1.+l, falloff);
	}
	return clamp(1.-ao*0.1,0.0,999.0);
}
vec3 normal( vec3 p )
{
	vec3 eps = vec3(0.001, 0.0, 0.0);
	return normalize( vec3(
		map(p+eps.xyy)-map(p-eps.xyy),
		map(p+eps.yxy)-map(p-eps.yxy),
		map(p+eps.yyx)-map(p-eps.yyx)
	));
}

void main()
{
	vec2 res = vec2(1280,720);
	vec2 q = gl_FragCoord.xy/res.xy;
	vec2 v = -1.0+2.0*q;
	v.x *= res.x/res.y;
	vec3 ro = vec3(0, 1.4+0.01*hash(t), -2);
	vec3 rd = normalize(vec3(v.x, v.y, 1.7));
	float t = 0.0;

	bool hit = false;
	for (int i = 0; i < 256 && t < T_MAX; ++i) {
		float dist = map(ro + t * rd);
		if (abs(dist) < 0.001*(1.0+t)) {
			hit = true;
			break;
		}
		t += dist;
	}

	vec3 sky_col = 1.4*vec3(0.5, 0.6, 0.7);
	sky_col = mix(sky_col, 0.5*sky_col, rd.y);
	vec3 col = sky_col;
	vec3 l = normalize(vec3(-2.0, 1.0, -1.0));
	if (hit)
	{
		vec3 p = ro + t * rd;
		vec3 n = normal(p);
		vec3 albedo = vec3(1);
		col = 0.7 * max(0.0, dot(n, l)) * albedo * shadow(p, l, 0.023, T_MAX, 0.05);
		col += 0.15 * sky_col * ao(p, n, 1.5, 1.0);
	}

	o = vec4(sqrt(col), 0.0);
}