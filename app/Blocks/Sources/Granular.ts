import Source = require("../Source");
import BlocksSketch = require("../../BlocksSketch");
import Grid = require("../../Grid");
import Particle = require("../../Particle");
import SoundCloudAudio = require('../SoundCloudAudio');
import SoundCloudAudioType = require('../SoundCloudAudioType');
import SoundcloudTrack = require("../../UI/SoundcloudTrack");

class Granular extends Source {

    public Sources: Tone.Signal[];
    public Grains: Tone.Player[] = [];
    private _Envelopes: Tone.AmplitudeEnvelope[] = [];
    public Timeout;
    public EndTimeout;
    private _FirstRelease: boolean = true;
    private _CurrentGrain: number = 0;
    private _IsLoaded: boolean;
    public GrainsAmount: number = 16;
    private _NoteOn: boolean = false;
    private _WaveForm: number[];
    private _FirstBuffer: any;

    Init(sketch?: Fayde.Drawing.SketchContext): void {
        if (!this.Params) {
            this.Params = {
                playbackRate: 1,
                density: 10,
                region: 0,
                spread: 1.5,
                grainlength: 0.25,
                track: '',
                trackName: 'TEUFELSBERG',
                user: 'BGXA'
            };
        }

        this._WaveForm = [];
        this.SearchResults = [];

        super.Init(sketch);

        this.Params.track = SoundCloudAudio.PickRandomTrack(SoundCloudAudioType.Granular);

        this.CreateSource();
        this.CreateEnvelope();
        this.CreateGrains();

        // Define Outline for HitTest
        this.Outline.push(new Point(-1, 0),new Point(0, -1),new Point(1, -1),new Point(2, 0),new Point(2, 1),new Point(1, 2));
    }

    Reset(){
        this.Grains.length = 0;
        this._Envelopes.length = 0;
    }

    Search(query: string) {
        this.SearchResults = [];
        if (window.SC) {
            SoundCloudAudio.Search(query, (tracks) => {
                tracks.forEach((track) => {
                    this.SearchResults.push(new SoundcloudTrack(track.title, track.user.username, track.uri));
                });
            });
        }
    }

    LoadTrack(track) {
        this.Params.track = SoundCloudAudio.LoadTrack(track);
        this.Params.trackName = track.TitleShort;
        this.Params.user = track.UserShort;
        this._WaveForm = [];
        this.SetupGrains();

        if (App.BlocksSketch.OptionsPanel.Scale==1 && (<BlocksSketch>this.Sketch).OptionsPanel.SelectedBlock==this) {
            this.UpdateOptionsForm();
            App.BlocksSketch.OptionsPanel.Populate(this.OptionsForm, false);
        }
    }

    CreateGrains() {
        if (!this.Grains[0]) {
            for (var i=0; i<this.GrainsAmount; i++) {

                // CREATE PLAYER //
                this.Grains[i] = new Tone.Player();

                // CREATE ENVELOPE //
                this._Envelopes[i] = new Tone.AmplitudeEnvelope(
                    this.Params.grainlength/2,  // Attack
                    0.01,                       // Decay
                    0.9,                        // Sustain
                    this.Params.grainlength/2   // Release
                );

                // CONNECT //
                this.Grains[i].connect(this._Envelopes[i]);
                this._Envelopes[i].connect(this.Sources[0]);
                this.Grains[i].playbackRate = this.Params.playbackRate;
            }
            this.Sources[0].connect(this.EffectsChainInput);
        }
    }

    SetupGrains() {
        // RESET //
        this._IsLoaded = false;
        var duration = this.GetDuration();
        //this.Params.region = duration/2;


        // LOAD FIRST BUFFER //
        App.AnimationsLayer.AddToList(this);
        this._FirstBuffer = new Tone.Player(this.Params.track, (e) => {
            this._WaveForm = this.GetWaveformFromBuffer(e.buffer._buffer,200,2,80);
            App.AnimationsLayer.RemoveFromList(this);
            this._IsLoaded = true;


            // COPY BUFFER TO GRAINS //
            for (var i=0; i<this.GrainsAmount; i++) {
                // fill buffer //
                this.Grains[i].buffer = e.buffer;
            }
            var duration = this.GetDuration();
            this.Params.region = duration/2;


            // UPDATE OPTIONS FORM //
            if ((<BlocksSketch>this.Sketch).OptionsPanel.Scale==1 && (<BlocksSketch>this.Sketch).OptionsPanel.SelectedBlock==this) {
                this.UpdateOptionsForm();
                (<BlocksSketch>this.Sketch).OptionsPanel.Populate(this.OptionsForm, false);
            }

            // start if powered //
            this.GrainLoop();
        });

    }

    GetDuration(): number {
        if (this._FirstBuffer){
            return this._FirstBuffer.buffer.duration;
        } else {
            return 0;
        }
    }

    Draw() {
        super.Draw();
        (<BlocksSketch>this.Sketch).BlockSprites.Draw(this.Position,true,"granular");
        if (this._WaveForm.length>0) {
        }
    }

    CreateSource(){
        this.Sources.push( new Tone.Signal() );
        // return it
        //TODO these extra sources need setting up somehow
        return super.CreateSource();
    }

    CreateEnvelope(){
        this.Envelopes.push( new Tone.AmplitudeEnvelope(
            this.Settings.envelope.attack,
            this.Settings.envelope.decay,
            this.Settings.envelope.sustain,
            this.Settings.envelope.release
        ) );
        return super.CreateEnvelope();
    }

    TriggerAttack() {
        super.TriggerAttack();
        if (this._IsLoaded) {

            /*this._Envelopes.forEach((e: Tone.AmplitudeEnvelope)=> {
                e.triggerAttack();
            });*/

            clearTimeout(this.EndTimeout);
            if (!this._NoteOn) {

                this._NoteOn = true;
                this.GrainLoop();
            }
        }
    }

    TriggerRelease() {
        super.TriggerRelease();

        /*this._Envelopes.forEach((e: Tone.AmplitudeEnvelope)=> {
            e.triggerRelease();
        });*/

        //clearTimeout(this.EndTimeout);
        this.EndTimeout = setTimeout(() => {
            this._NoteOn = false;
        }, <number>this._Envelopes[0].release*1000);
    }

    TriggerAttackRelease(){
    }


    MouseUp() {
        if (this._FirstRelease) {

            this.Sources.forEach((s: Tone.Signal, i: number) => {
                s.connect(this.Envelopes[i]);
            });

            this.Envelopes.forEach((e: Tone.AmplitudeEnvelope)=> {
                e.connect(this.EffectsChainInput);
            });

            this.Search(App.BlocksSketch.SoundcloudPanel.RandomSearch());
            this.SetupGrains();

            this._FirstRelease = false;
        }

        super.MouseUp();
    }

    GrainLoop() {

        // CYCLES THROUGH GRAINS AND PLAYS THEM //
        if (this._Envelopes[this._CurrentGrain] && (this.IsPowered() || this._NoteOn)) {

           var location = this.LocationRange(
               this.Params.region - (this.Params.spread * 0.5) + (Math.random() * this.Params.spread)
           );

            // MAKE SURE THESE ARE IN SYNC //
            this._Envelopes[this._CurrentGrain].triggerAttackRelease(this.Params.grainlength/2,"+0.01");
            this.Grains[this._CurrentGrain].stop();
            this.Grains[this._CurrentGrain].playbackRate = this.Params.playbackRate;
            this.Grains[this._CurrentGrain].start("+0.01", location, (this.Params.grainlength*this.Params.playbackRate)*1.9);
            clearTimeout(this.Timeout);
            this.Timeout = setTimeout(() => {
                this.GrainLoop();
            }, Math.round(((this.Params.grainlength*2) / this.Params.density)*1500));

            this._CurrentGrain += 1;
            if (this._CurrentGrain >= this.Params.density) {
                this._CurrentGrain = 0;
            }
        }
    }


    // CAP POSITIONS OF GRAINS TO STAY WITHIN TRACK LENGTH //
    LocationRange(location: number) {
        var locationCap = this.Grains[0].duration - this.Params.grainlength;
        if (location < 0) {
            location = 0;
        } else if (location > locationCap) {
            location = locationCap;
        }
        return location;
    }

    SetPitch(pitch: number, sourceId?: number, rampTime?: Tone.Time) {
        for (var i=0; i<this.GrainsAmount; i++) {
            this.Grains[i].playbackRate = pitch / App.Config.BaseNote;
        }
        this.Params.playbackRate = this.Grains[0].playbackRate;
    }

    SetParam(param: string,value: number) {
        super.SetParam(param,value);

        switch (param){
            case "density": this.Params.density = value;
                break;
            case "grainlength":
                this.Params.grainlength = value;
                for (var i=0; i< this.GrainsAmount; i++) {
                    this._Envelopes[i].attack = value/2;
                    this._Envelopes[i].release = value/2;
                }

                break;
            case "spread": this.Params.spread = value;
                break;
            case "region": this.Params.region = value;
                break;
        }
    }


    UpdateOptionsForm() {
        super.UpdateOptionsForm();

        this.OptionsForm =
        {
            "name" : "Granular",
            "parameters" : [

                {
                    "type" : "waveslider",
                    "name" : "Location",
                    "setting" :"region",
                    "props" : {
                        "value" : this.Params.region,
                        "min" : 0,
                        "max" : this.GetDuration(),
                        "quantised" : false,
                        "centered" : false,
                        "wavearray" : this._WaveForm,
                        "spread" : this.Params.spread
                    }
                },
                {
                    "type" : "sample",
                    "name" : "Sample",
                    "setting" :"sample",
                    "props" : {
                        "track" : this.Params.trackName,
                        "user" : this.Params.user
                    }
                },
                {
                    "type" : "slider",
                    "name" : "Spread",
                    "setting" :"spread",
                    "props" : {
                        "value" : this.Params.spread,
                        "min" : 0,
                        "max" : 4,
                        "quantised" : false,
                        "centered" : false
                    }
                },
                {
                    "type" : "slider",
                    "name" : "Grain Size",
                    "setting" :"grainlength",
                    "props" : {
                        "value" : this.Params.grainlength,
                        "min" : 0.03,
                        "max" : 0.5,
                        "quantised" : false,
                        "centered" : false
                    }
                },
                {
                    "type" : "slider",
                    "name" : "Density",
                    "setting" :"density",
                    "props" : {
                        "value" : this.Params.density,
                        "min" : 2,
                        "max" : this.GrainsAmount,
                        "quantised" : true,
                        "centered" : false
                    }
                }
            ]
        };
    }

    Dispose(){
        super.Dispose();
        clearTimeout(this.Timeout);
        this._NoteOn = false;

        this.Grains.forEach((g: Tone.Player)=> {
            g.dispose();
        });

        this._Envelopes.forEach((e: Tone.AmplitudeEnvelope)=> {
            e.dispose();
        });

        this.Envelopes.forEach((e: Tone.AmplitudeEnvelope)=> {
            e.dispose();
        });

        this.Sources.forEach((s: Tone.Signal)=> {
            s.dispose();
        });

        this.Grains.length = 0;
        this._Envelopes.length = 0;
    }
}

export = Granular;