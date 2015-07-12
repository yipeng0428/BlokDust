import Grid = require("../../Grid");
import BlocksSketch = require("../../BlocksSketch");
import Source = require("../Source");

class RecorderBlock extends Source {

    public Sources : Tone.Sampler[];
    public Recorder: any;
    public BufferSource;
    public Filename: string;
    public IsRecording: boolean = false;
    public RecordedBlob;
    public PlaybackRate: number;
    private _WaveForm: number[];

    Init(sketch?: Fayde.Drawing.SketchContext): void {

        this.PlaybackRate = 1;

        if (!this.Params) {
            this.Params = {
                playbackRate: 1,
                reverse: 0, //TODO: Should be boolean,
                startPosition: 0,
                endPosition: 0,
                loop: 1, //TODO: Should be boolean,
                loopStart: 0,
                loopEnd: 0,
                retrigger: false, //Don't retrigger attack if already playing
                volume: 0
            };
        }

        this._WaveForm = [];

        super.Init(sketch);

        this.CreateSource();
        this.BufferSource = App.AudioMixer.Master.context.createBufferSource();

        this.Recorder = new Recorder(App.AudioMixer.Master, {
            workerPath: App.Config.RecorderWorkerPath
        });

        this.Envelopes.forEach((e: Tone.AmplitudeEnvelope, i: number)=> {
            e = this.Sources[i].envelope;
        });

        this.Sources.forEach((s: Tone.Sampler) => {
            s.connect(this.EffectsChainInput);
            s.volume.value = this.Params.volume;
        });

        this.Filename = "BlokdustRecording.wav"; //TODO: make an input box for filename download

        // Define Outline for HitTest
        this.Outline.push(new Point(-1, 0),new Point(0, -1),new Point(1, -1),new Point(2, 0),new Point(2, 1),new Point(1, 2));


        //RECORD BUTTON TODO: make this a command in the command manager
        App.KeyboardInput.KeyDownChange.on(this.KeyDownCallback, this);
    }

    Update() {
        super.Update();
    }

    Draw() {
        super.Draw();
        (<BlocksSketch>this.Sketch).BlockSprites.Draw(this.Position,true,"recorder");
    }

    KeyDownCallback(e){

        if ((<any>e).KeyDown === 'spacebar'){
            // Start recording on spacebar
            this.ToggleRecording();
        }
    }

    ToggleRecording(){
        if (this.IsRecording) {
            this.StopRecording();
        } else {
            this.StartRecording();
        }
    }

    StartRecording() {
        this.Recorder.clear();
        console.log('STARTED RECORDING...');
        this.IsRecording = true;
        this.Recorder.record();
    }

    StopRecording() {
        this.Recorder.stop();
        this.IsRecording = false;
        console.log('STOPPED RECORDING');
        this.SetBuffers();
    }

    SetBuffers() {

        this.Recorder.getBuffers((buffers) => {

            // if BufferSource doesn't exist create it
            if (!this.BufferSource) {
                this.BufferSource = this.Sources[0].context.createBufferSource();
            }
            // If we already have a BufferSource and the buffer is set, reset it to null and create a new one
            else if (this.BufferSource && this.BufferSource.buffer !== null){
                this.BufferSource = null;
                this.BufferSource = this.Sources[0].context.createBufferSource();
            }

            // TODO: add a 'merge new buffers with old buffers' option



            // Create a new buffer and set the buffers to the recorded data
            this.BufferSource.buffer = this.Sources[0].context.createBuffer(1, buffers[0].length, 44100);
            this.BufferSource.buffer.getChannelData(0).set(buffers[0]);
            this.BufferSource.buffer.getChannelData(0).set(buffers[1]);

// Update waveform
            this._WaveForm = this.GetWaveformFromBuffer(this.BufferSource.buffer,200,2,95);
            var duration = this.GetDuration();
            this.Params.startPosition = 0;
            this.Params.endPosition = duration;
            this.Params.loopStart = duration * 0.5;
            this.Params.loopEnd = duration * 0.75;

            if ((<BlocksSketch>this.Sketch).OptionsPanel.Scale==1 && (<BlocksSketch>this.Sketch).OptionsPanel.SelectedBlock==this) {
                this.UpdateOptionsForm();
                (<BlocksSketch>this.Sketch).OptionsPanel.Populate(this.OptionsForm, false);
            }

            // Set the buffers for each source
            this.Sources.forEach((s: Tone.Sampler)=> {
                s.player.buffer = this.BufferSource.buffer;
                s.player.startPosition = this.Params.startPosition;
                s.player.duration = this.Params.endPosition - this.Params.startPosition;
                s.player.loopStart = this.Params.loopStart;
                s.player.loopEnd = this.Params.loopEnd;
            });

            this._OnBuffersReady();
        });
    }

    private _OnBuffersReady() {
        console.log("READY FOR PLAYBACK - CLICK, POWER OR CONNECT TO AN INTERACTION BLOCK")
    }

    GetDuration() {
        var duration = 0;
        if (this.BufferSource && this.BufferSource.buffer !== null){
            duration = this.BufferSource.buffer.duration;
        }
        if (duration==0) {
            duration = 10;
        }
        return duration;
    }

    GetRecordedBlob() {
        this.Recorder.exportWAV((blob) => {
            this.RecordedBlob = blob;
        });

        return this.RecordedBlob;
    }

    DownloadRecording() {
        this.Recorder.setupDownload(this.GetRecordedBlob(), this.Filename);
    }

    Dispose(){
        super.Dispose();
        App.KeyboardInput.KeyDownChange.off(this.KeyDownCallback, this);
        this.BufferSource = null;
        this.Recorder.clear();
        this.Recorder = null;
        this.RecordedBlob = null;
        this.Sources.forEach((s: any)=> {
            s.dispose();
        });
    }

    CreateSource(){
        this.Sources.push( new Tone.Sampler(this.BufferSource) );

        this.Sources.forEach((s: Tone.Sampler, i: number)=> {
            s.player.startPosition = this.Params.startPosition;
            s.player.duration = this.Params.endPosition - this.Params.startPosition;
            s.player.loop = this.Params.loop;
            s.player.loopStart = this.Params.loopStart;
            s.player.loopEnd = this.Params.loopEnd;
            s.player.retrigger = this.Params.retrigger;
            s.player.reverse = this.Params.reverse;

            if (i > 0){
                s.player.buffer = this.Sources[0].player.buffer;
            }
        });

        return super.CreateSource();
    }

    UpdateOptionsForm() {
        super.UpdateOptionsForm();

        this.OptionsForm =
        {
            "name" : "Recorder",
            "parameters" : [

                {
                    "type" : "waveregion",
                    "name" : "Recording",
                    "setting" :"region",
                    "props" : {
                        "value" : 5,
                        "min" : 0,
                        "max" : this.GetDuration(),
                        "quantised" : false,
                        "centered" : false,
                        "wavearray" : this._WaveForm
                    },"nodes": [
                    {
                        "setting": "startPosition",
                        "value": this.Params.startPosition
                    },

                    {
                        "setting": "endPosition",
                        "value": this.Params.endPosition
                    },

                    {
                        "setting": "loopStart",
                        "value": this.Params.loopStart
                    },

                    {
                        "setting": "loopEnd",
                        "value": this.Params.loopEnd
                    }
                ]
                },
                {
                    "type" : "switches",
                    "name" : "Loop",
                    "setting" :"loop",
                    "props" : {
                        "value" : this.Params.loop,
                        "min" : 0,
                        "max" : 1,
                        "quantised" : true,
                    },
                    "switches": [
                        {
                            "name": "Reverse",
                            "setting": "reverse",
                            "value": this.Params.reverse
                        },
                        {
                            "name": "Looping",
                            "setting": "loop",
                            "value": this.Params.loop
                        }
                    ]
                }/*,
                {
                    "type" : "slider",
                    "name" : "Reverse",
                    "setting" :"reverse",
                    "props" : {
                        "value" : this.Params.reverse,
                        "min" : 0,
                        "max" : 1,
                        "quantised" : true,
                    }
                },
                {
                    "type" : "slider",
                    "name" : "Loop",
                    "setting" :"loop",
                    "props" : {
                        "value" : this.Params.loop,
                        "min" : 0,
                        "max" : 1,
                        "quantised" : true,
                    }
                }*/,
                {
                    "type" : "slider",
                    "name" : "playback",
                    "setting" :"playbackRate",
                    "props" : {
                        "value" : this.Params.playbackRate,
                        "min" : 0.125,
                        "max" : 8,
                        "quantised" : false,
                        "centered" : true,
                        "logarithmic": true
                    }
                }/*,
                {
                    "type" : "slider",
                    "name" : "Start Position",
                    "setting" :"startPosition",
                    "props" : {
                        "value" : this.Params.startPosition,
                        "min" : 0,
                        "max" : 10,//this.GetDuration(),
                        "quantised" : false,
                    }
                },
                {
                    "type" : "slider",
                    "name" : "Loop Start",
                    "setting" :"loopStart",
                    "props" : {
                        "value" : this.Params.loopStart,
                        "min" : 0,
                        "max" : 20,//this.GetDuration(),
                        "quantised" : false,
                    }
                },
                {
                    "type" : "slider",
                    "name" : "Loop End",
                    "setting" :"loopEnd",
                    "props" : {
                        "value" : this.Params.loopEnd,
                        "min" : 0.0001,
                        "max" : 20,//this.GetDuration(),
                        "quantised" : false,
                    }
                },
                {
                    "type" : "slider",
                    "name" : "Volume",
                    "setting" :"volume",
                    "props" : {
                        "value" : this.Params.volume,
                        "min" : 0,
                        "max" : 20,
                        "quantised" : false,
                    }
                }*/
            ]
        };
    }

    SetParam(param: string,value: any) {
        super.SetParam(param,value);
        var val = value;

        switch(param) {
            case "playbackRate":
                this.Sources[0].player.playbackRate = value;
                break;
            case "reverse":
                value = value? true : false;
                console.log("out: "+ value);
                this.Sources.forEach((s: Tone.Sampler)=> {
                    s.player.reverse = value;
                    console.log(s.player.reverse);
                });
                // Update waveform
                this._WaveForm = this.GetWaveformFromBuffer(this.BufferSource.buffer,200,2,95);
                if ((<BlocksSketch>this.Sketch).OptionsPanel.Scale==1 && (<BlocksSketch>this.Sketch).OptionsPanel.SelectedBlock==this) {
                    this.Params[param] = val;
                    this.UpdateOptionsForm();
                    (<BlocksSketch>this.Sketch).OptionsPanel.Populate(this.OptionsForm, false);
                }
                break;
            case "startPosition":
                this.Sources.forEach((s: Tone.Sampler)=> {
                    s.player.startPosition = value;
                });
                break;
            case "endPosition":
                this.Sources.forEach((s: Tone.Sampler)=> {
                    s.player.duration = value - this.Params.startPosition;
                });
                break;
            case "loop":
                value = value? true : false;
                this.Sources.forEach((s: Tone.Sampler)=> {
                    s.player.loop = value;
                });
                break;
            case "loopStart":
                this.Sources.forEach((s: Tone.Sampler)=> {
                    s.player.loopStart = value;
                });
                break;
            case "loopEnd":
                this.Sources.forEach((s: Tone.Sampler)=> {
                    s.player.loopEnd = value;
                });
                break;
        }

        this.Params[param] = val;
    }
}

export = RecorderBlock;