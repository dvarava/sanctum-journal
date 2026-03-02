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
	export class CrisisResult {
	    is_crisis: boolean;
	    severity: string;
	    patterns: string[];
	
	    static createFrom(source: any = {}) {
	        return new CrisisResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.is_crisis = source["is_crisis"];
	        this.severity = source["severity"];
	        this.patterns = source["patterns"];
	    }
	}
	export class Entry {
	    id: number;
	    title: string;
	    content: string;
	    preview: string;
	    emotions: string[];
	    created_at: string;
	
	    static createFrom(source: any = {}) {
	        return new Entry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.title = source["title"];
	        this.content = source["content"];
	        this.preview = source["preview"];
	        this.emotions = source["emotions"];
	        this.created_at = source["created_at"];
	    }
	}

}

