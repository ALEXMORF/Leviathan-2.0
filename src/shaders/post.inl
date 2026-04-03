// Generated with Shader Minifier 1.6.0 (https://github.com/laurentlb/Shader_Minifier/)
#ifndef POST_INL_
# define POST_INL_
# define VAR_i "v"
# define VAR_o "f"

const char *post_frag =
 "#version 130\n"
 "uniform sampler2D f;"
 "out vec4 v;"
 "float t(float f)"
 "{"
   "return fract(sin(dot(f,12.9898))*43758.5453);"
 "}"
 "void main()"
 "{"
   "v=vec4(0);"
   "for(int s=0;s<25;s++)"
     "{"
       "vec2 d=gl_FragCoord.xy/vec2(1280,720);"
       "float i=t(float(s+dot(d,d))),C=t(float(1-s+dot(d,d)));"
       "v+=vec4(textureLod(f,d,(.3+.7*i)*texture(f,(1.+.01*(-1.+2.*vec2(i,C)))*d).w*8).xyz,1);"
     "}"
   "v/=vec4(25);"
 "}";

#endif // POST_INL_
