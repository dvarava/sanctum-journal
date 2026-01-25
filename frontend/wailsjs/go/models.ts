export namespace main {
	
	export class AnalysisResult {
	    emotions: string[];
	    coaching: string;
	
	    static createFrom(source: any = {}) {
	        return new AnalysisResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.emotions = source["emotions"];
	        this.coaching = source["coaching"];
	    }
	}

}

