---
title: RenderDoc抓帧原理
published: 2025-12-22
category: 图形学
---

RenderDoc抓帧原理

# 名词说明


| RenderDocUI、Host、qrenderdoc | 运行在PC上的RenderDoc客户端 |  |
| --- | --- | --- |
| HookTarget | Record进程 - 需要捕获图形指令的应用 |  |
| ReplayAPKrenderdoccmdorg.renderdoc.renderdoccmd.arm64 | Replay进程 - 执行指令重放的应用 |  |
| RemoteServer | Replay进程创建的一个Server线程，与Host进行通信 |  |
| TargetControlServer | Record进程创建的一个Server线程，与Host进行通信 |  |
| rdc文件 | Capture过程中捕获的资源、渲染相关的指令信息，还包括缩略图等其他信息 |  |


# 抓帧流程


![image.png](/images/posts/dlslk40lp0fsl9sc_image_00.png)


# 核心模块


## Hooks - Android GLES Layers


### 什么是GLES Layers？


![image.png](/images/posts/dlslk40lp0fsl9sc_image_01.png)


### 如何制作一个GLES Layer


编译生成一个so文件，需要导出两个符号

```cpp
typedef void* (*PFNEGLGETNEXTLAYERPROCADDRESSPROC)(void*, const char*);void* AndroidGLESLayer_Initialize(void* layer_id, PFNEGLGETNEXTLAYERPROCADDRESSPROC get_next_layer_proc_address))typedef __eglMustCastToProperFunctionPointerType EGLFuncPointer;void* AndroidGLESLayer_GetProcAddress(const char *funcName, EGLFuncPointer next)
```


RenderDoc中的实现

```cpp
typedef __eglMustCastToProperFunctionPointerType(EGLAPIENTRY *PFNEGLGETNEXTLAYERPROCADDRESSPROC)(void *, const char *funcName);HOOK_EXPORT void AndroidGLESLayer_Initialize(void *layer_id,PFNEGLGETNEXTLAYERPROCADDRESSPROC next_gpa){    RDCLOG("Initialising Android GLES layer with ID %p", layer_id);    // as a hook callback this is only called while capturing    RDCASSERT(!RenderDoc::Inst().IsReplayApp());    // populate EGL dispatch table with the next layer's function pointers. Fetch all 'hooked' and    // non-hooked functions    #define EGL_FETCH(func, isext, replayrequired)                                 \    EGL.func = (CONCAT(PFN_egl, func))next_gpa(layer_id, "egl" STRINGIZE(func)); \    if(!EGL.func)                                                                \    RDCWARN("Couldn't fetch function pointer for egl" STRINGIZE(func));    EGL_HOOKED_SYMBOLS(EGL_FETCH)        EGL_NONHOOKED_SYMBOLS(EGL_FETCH)        #undef EGL_FETCH        // populate GL dispatch table with the next layer's function pointers        GL.PopulateWithCallback(        [layer_id, next_gpa](const char *f) { return (void *)next_gpa(layer_id, f); });}HOOK_EXPORT void *AndroidGLESLayer_GetProcAddress(const char *funcName,__eglMustCastToProperFunctionPointerType next){    // return our egl hooks    #define GPA_FUNCTION(name, isext, replayrequired) \    if(!strcmp(funcName, "egl" STRINGIZE(name)))    \    return (void *)&CONCAT(egl, CONCAT(name, _renderdoc_hooked));    EGL_HOOKED_SYMBOLS(GPA_FUNCTION)    #undef GPA_FUNCTION    // otherwise, consult our database of hooks    // Android GLES layer spec expects us to return next unmodified for functions we don't support    return HookedGetProcAddress(funcName, (void *)next);}
```


根据传入的next_gpa函数生成两个DispatchTable：EGL和GL，即EGL和GL相关的两个函数表

```cpp
// We need to disable clang-format since this struct is programmatically parsed// clang-format offstruct GLDispatchTable{// This function can be used to populate the dispatch table, fully or partiall. Any NULL function// will be passed to the callback to get a pointervoid PopulateWithCallback(PlatformGetProcAddr lookupFunc);// These functions are called after fully populating the hookset, to emulate functions that are// one way or another unsupported but we can software emulate them and want to assume their// presence.void EmulateUnsupportedFunctions();void EmulateRequiredExtensions();void DriverForEmulation(WrappedOpenGL *driver);// first we list all the core functions. 1.1 functions are separate under 'dllexport' for// different handling on windows. Extensions come after.// Any Core functions that are semantically identical to extension variants are listed as// 'aliases' such that if the 'alias' is requested via *GetProcAddress, the core function// will be returned and used.PFNGLBINDTEXTUREPROC glBindTexture;PFNGLBLENDFUNCPROC glBlendFunc;PFNGLCLEARPROC glClear;PFNGLCLEARCOLORPROC glClearColor;PFNGLCLEARDEPTHPROC glClearDepth;PFNGLCLEARSTENCILPROC glClearStencil// .......................}
```


返回funcName对应的Hook后的函数地址，以eglDestroyContext举例，首先renderdoc定义了该函数的hook版本

```cpp
HOOK_EXPORT EGLBoolean EGLAPIENTRY eglDestroyContext_renderdoc_hooked(EGLDisplay dpy, EGLContext ctx){    if(RenderDoc::Inst().IsReplayApp())    {        if(!EGL.DestroyContext)            EGL.PopulateForReplay();        return EGL.DestroyContext(dpy, ctx);    }    EnsureRealLibraryLoaded();    eglhook.driver.SetDriverType(eglhook.activeAPI);    {        SCOPED_LOCK(glLock);        eglhook.driver.DeleteContext(ctx);        eglhook.contexts.erase(ctx);    }    return EGL.DestroyContext(dpy, ctx);}
```


AndroidGLESLayer_GetProcAddress("eglDestroyContext", next)就会返回eglDestroyContext_renderdoc_hooked的地址

### GLES Layer的使用


#### Layer的推送


#### Layer的启用


```cpp
adb.exe '-s YPRKYH99RGVCEEXO shell settings put global enable_gpu_debug_layers 1'    adb.exe '-s YPRKYH99RGVCEEXO shell settings put global gpu_debug_app com.glumes.opengl_tutorial_practice'    adb.exe '-s YPRKYH99RGVCEEXO shell settings put global gpu_debug_layer_app org.renderdoc.renderdoccmd.arm64'    adb.exe '-s YPRKYH99RGVCEEXO shell settings put global gpu_debug_layers VK_LAYER_RENDERDOC_Capture'    adb.exe '-s YPRKYH99RGVCEEXO shell settings put global gpu_debug_layers_gles libVkLayer_GLES_RenderDoc.so'    adb.exe '-s YPRKYH99RGVCEEXO shell setprop debug.rdoc.IGNORE_LAYERS 0'
```


## Record & Replay


### 一个朴素的实现


Hook上目标应用后序列化所有的GL调用，重放时再依序执行。
存在的问题

### RenderDoc的优化


#### 录制引入的几个概念


##### 概念1：BackgroundCapturing和ActiveCapturing


优化1：对于BackgroundCapturing状态下的资源更新，不需要保存，只需要将该资源标记为dirty，因为我们只需要获取目标帧开始前对应资源的内容

##### 概念2：资源的FrameReferrenceType


```cpp
// In what way (read, write, etc) was a resource referenced in a frame -// used to determine if initial contents are needed and to what degree.// These values are used both as states (representing the cumulative previous// accesses to the resource), and state transitions (access by a single// command, modifying the state). This state machine is illustrated below,// with states represented in caps, and transitions in lower case.////         +------------------ NONE -----------------------------+//         |                    |                                |//        read            partialWrite                     completeWrite//         |                    |                                |//         V                    V                                V//       READ             PARTIAL_WRITE --completeWrite--> COMPLETE_WRITE//         |                    |//         |                  read//       write                  |//         |                    V//         |            WRITE_BEFORE_READ//         V                    |//  READ_BEFORE_WRITE <--write--+//// Note://  * All resources begin implicitly in the None state.//  * The transitions labeled "write" correspond to either PartialWrite or//    CompleteWrite (e.g. in the READ state, either a PartialWrite or a//    CompleteWrite moves to the READ_BEFORE_WRITE state).//  * The state transitions for ReadBeforeWrite are simply the composition of//    the transition for read, followed by the transition for write (e.g.//    ReadBeforeWrite moves from NONE state to READBEFOREWRITE state);//    similarly, the state transitions for WriteBeforeRead are the composition//    of the transition for write, followed by the transition for read.//  * All other transitions (excluding ReadBeforeWrite and WriteBeforeRead)//    that are not explicitly shown leave the state unchanged (e.g. a read in//    the COMPLETE_WRITE state remains in the COMPLETE_WRITE state).
```


优化2：对于目标帧没有访问到的资源，不需要序列化

##### 概念3：Persistent资源的Postpone初始化机制


优化3：对于Persistent资源，也就是该资源很久没有更新过了，那么大概率抓取的目标帧也不会对该资源进行写入，那么目标帧开始前不需要对该资源进行备份，而是延迟到目标帧结束后，再按需进行资源的序列化。（按需指的是目标帧是否真正访问了该资源，没有访问就没必要序列化）

#### 录制的流程


##### StartFrameCapture


```cpp
// 清空m_FrameReferencedResources，如果某个资源被写入了，标记为dirtytemplate <typename Configuration>void ResourceManager<Configuration>::ClearReferencedResources(){    SCOPED_LOCK_OPTIONAL(m_Lock, m_Capturing);    for(auto it = m_FrameReferencedResources.begin(); it != m_FrameReferencedResources.end(); ++it)        {            RecordType *record = GetResourceRecord(it->first);            if(record)            {                if(IncludesWrite(it->second))                    MarkDirtyResource(it->first);                record->Delete(this);            }        }    m_FrameReferencedResources.clear();}
```


```cpp
void GLResourceManager::ContextPrepare_InitialState(GLResource res){    GLInitialContents initContents;    initContents.type = res.Namespace;    ResourceId id = GetID(res);    if(res.Namespace == eResBuffer)    {        // get the length of the buffer        uint32_t length = 4;        GL.glGetNamedBufferParameterivEXT(res.name, eGL_BUFFER_SIZE, (GLint *)&length);        // save old bindings        GLuint oldbuf1 = 0, oldbuf2 = 0;        GL.glGetIntegerv(eGL_COPY_READ_BUFFER_BINDING, (GLint *)&oldbuf1);        GL.glGetIntegerv(eGL_COPY_WRITE_BUFFER_BINDING, (GLint *)&oldbuf2);        // create a new buffer big enough to hold the contents        GLuint buf = 0;        GL.glGenBuffers(1, &buf);        GL.glBindBuffer(eGL_COPY_WRITE_BUFFER, buf);        GL.glNamedBufferDataEXT(buf, (GLsizeiptr)RDCMAX(length, 4U), NULL, eGL_STATIC_READ);        // bind the live buffer for copying        GL.glBindBuffer(eGL_COPY_READ_BUFFER, res.name);        // do the actual copy        if(length > 0)            GL.glCopyBufferSubData(eGL_COPY_READ_BUFFER, eGL_COPY_WRITE_BUFFER, 0, 0, (GLsizeiptr)length);        // workaround for some drivers - mapping/unmapping here seems to help avoid problems mapping        // later.        GL.glMapNamedBufferEXT(buf, eGL_READ_ONLY);        GL.glUnmapNamedBufferEXT(buf);        // restore old bindings        GL.glBindBuffer(eGL_COPY_READ_BUFFER, oldbuf1);        GL.glBindBuffer(eGL_COPY_WRITE_BUFFER, oldbuf2);        initContents.resource = GLResource(res.ContextShareGroup, eResBuffer, buf);        initContents.bufferLength = length;    }    else if(res.Namespace == eResProgram)    {        // ...    }    // else ...
```


##### 录制过程中


以glBindBuffer举例

```cpp
void WrappedOpenGL::glBindBuffer(GLenum target, GLuint buffer){    SERIALISE_TIME_CALL(GL.glBindBuffer(target, buffer)); // 真正的GL指令调用    ContextData &cd = GetCtxData();    size_t idx = BufferIdx(target); // 获取到当前逻辑Context中对应target槽位    if(IsActiveCapturing(m_State)) // 如果是处于ActiveCapturing状态下    {        Chunk *chunk = NULL;        if(buffer == 0)        {            cd.m_BufferRecord[idx] = NULL;        }        else        {            // 每个资源都对应一个ResourceRecord对象，这里是获取到新绑定的资源对应的ResourceRecord            cd.m_BufferRecord[idx] = GetResourceManager()->GetResourceRecord(BufferRes(GetCtx(), buffer));            if(cd.m_BufferRecord[idx] == NULL)            {                RDCERR("Called glBindBuffer with unrecognised or deleted buffer");                return;            }        }        {            USE_SCRATCH_SERIALISER();            SCOPED_SERIALISE_CHUNK(gl_CurChunk);            Serialise_glBindBuffer(ser, target, buffer); // 序列化和反序列化都是用这个函数            if(cd.m_BufferRecord[idx])                cd.m_BufferRecord[idx]->datatype = target;            chunk = scope.Get();        }        if(buffer)        {            FrameRefType refType = eFrameRef_Read;            // these targets write to the buffer            if(target == eGL_ATOMIC_COUNTER_BUFFER || target == eGL_COPY_WRITE_BUFFER ||                target == eGL_PIXEL_PACK_BUFFER || target == eGL_SHADER_STORAGE_BUFFER ||                target == eGL_TRANSFORM_FEEDBACK_BUFFER)                refType = eFrameRef_ReadBeforeWrite;            // 这里就是前面提到的，更新资源的引用状态            GetResourceManager()->MarkResourceFrameReferenced(cd.m_BufferRecord[idx]->GetResourceID(),                refType);        }        // binding this buffer mutates VAO state, mark it as written.        if(target == eGL_ELEMENT_ARRAY_BUFFER)        {            GLResourceRecord *varecord = cd.m_VertexArrayRecord;            if(varecord)                GetResourceManager()->MarkVAOReferenced(varecord->Resource, eFrameRef_ReadBeforeWrite);        }
```


##### EndFrameCapture


遍历m_FrameReferencedResources， 收集每个资源对应的ResourceRecord对象中记录的指令序列，比如某个纹理资源的创建指令
序列化StartFrameCapture.PrepareInitialContents过程备份的资源数据，注意这里也只会序列化m_FrameReferencedResources中的资源。
同样以buffer举例

```cpp
template <typename SerialiserType>bool GLResourceManager::Serialise_InitialState(SerialiserType &ser, ResourceId id,GLResourceRecord *record,const GLInitialContents *initial){    m_State = m_Driver->GetState();    GLInitialContents initContents;    if(initial)        initContents = *initial;    SERIALISE_ELEMENT(id).TypedAs("GLResource"_lit).Important();    SERIALISE_ELEMENT_LOCAL(Type, initial->type);    if(IsReplayingAndReading())    {        m_Driver->AddResourceCurChunk(id);    }    if(Type == eResBuffer)    {        GLResource mappedBuffer = GLResource(MakeNullResource);        uint32_t BufferContentsSize = 0;        byte *BufferContents = NULL;        if(ser.IsWriting())        {            mappedBuffer = initial->resource;            BufferContentsSize = initial->bufferLength;            BufferContents = (byte *)GL.glMapNamedBufferEXT(mappedBuffer.name, eGL_READ_ONLY);            if(!BufferContents)                RDCERR("Couldn't map initial contents buffer for readback!");        }        // Serialise this separately so that it can be used on reading to prepare the upload memory        SERIALISE_ELEMENT(BufferContentsSize);        // not using SERIALISE_ELEMENT_ARRAY so we can deliberately avoid allocation - we serialise        // directly into upload memory        ser.Serialise("BufferContents"_lit, BufferContents, BufferContentsSize, SerialiserFlags::NoFlags)            .Important();        if(mappedBuffer.name)            GL.glUnmapNamedBufferEXT(mappedBuffer.name);        SERIALISE_CHECK_READ_ERRORS();    }    // else ...}
```


#### 重放


The replay process is ostensibly simple, but as with the capturing the devil is in the details.

##### ActionList


> RenderDoc then does an initial pass over the captured frame. This allows us to build up a list of all the actions, analyse dependencies and check which resources are used at each action for read, write, and so on. An internal tree is built up similar to what you see in the Event Browser & API Inspector, as well as a linked list with the linear sequence of actions, since both representations are useful for iterating over the frame.


![](/images/posts/dlslk40lp0fsl9sc_image_02.jpeg)


```cpp
enum class ActionFlags : uint32_t{NoFlags = 0x0000,// typesClear = 0x0001,Drawcall = 0x0002,Dispatch = 0x0004,MeshDispatch = 0x0008,CmdList = 0x0010,SetMarker = 0x0020,PushMarker = 0x0040,PopMarker = 0x0080,Present = 0x0100,MultiAction = 0x0200,Copy = 0x0400,Resolve = 0x0800,GenMips = 0x1000,PassBoundary = 0x2000,DispatchRay = 0x4000,BuildAccStruct = 0x8000,// flagsIndexed = 0x010000,Instanced = 0x020000,Auto = 0x040000,Indirect = 0x080000,ClearColor = 0x100000,ClearDepthStencil = 0x200000,BeginPass = 0x400000,EndPass = 0x800000,CommandBufferBoundary = 0x1000000,};
```


# Effect+RenderDoc需要/可以做些什么


```cpp
void WrappedOpenGL::SwapBuffers(WindowingSystem winSystem, void *windowHandle){    if(IsBackgroundCapturing(m_State))        RenderDoc::Inst().Tick();    // don't do anything if no context is active.    if(m_ActiveContexts[Threading::GetCurrentID()].ctx == NULL)    {        m_NoCtxFrames++;        if(m_NoCtxFrames == 100)        {            RDCERR(                "Seen 100 frames with no context current. RenderDoc requires a context to be current "                "during the call to SwapBuffers to display its overlay and start/stop captures on "                "default keys.\nIf your GL use is elsewhere, consider using the in-application API to "                "trigger captures manually");        }        return;    }    m_NoCtxFrames = 0;    m_FrameCounter++;    // first present becomes frame #1, this function is at the end of the frame    ContextData &ctxdata = GetCtxData();    // ...}
```
