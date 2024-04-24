import { docs_v1, google } from 'googleapis';

const docs = google.docs({
	version: 'v1',
	auth: new google.auth.JWT({
		email: process.env['GOOGLEAPI_CLIENT_EMAIL'],
		key: process.env['GOOGLEAPI_PRIVATE_KEY']!.replace(/\\n/g, '\n'),
		scopes: ['https://www.googleapis.com/auth/documents.readonly'],
	}),
});

function readParagraph(paragraph: docs_v1.Schema$Paragraph) {
	// Iterate through paragraph elements
	return paragraph.elements!.map((element) => {
		return element.textRun ?
			element.textRun.content : null;
	}).filter(m => typeof m === 'string') as string[];
}

function readTable(table: docs_v1.Schema$Table) {
	const story: string[] = [];
	table.tableRows?.forEach((row) => {
		// Iterate through table cells in the row
		row.tableCells?.forEach((cell) => {
		  // Iterate through elements in the cell
		  cell.content?.forEach((element) => {
			if (element.paragraph && element.paragraph.elements) {
			  // Iterate through paragraph elements in the cell
			  element.paragraph.elements.forEach((paragraphElement) => {
				if (paragraphElement.textRun) {
				  // Output the text content of the table cell
				  story.push(paragraphElement.textRun.content || '');
				}
			  });
			}
		  });
		});
	});

	return story.filter(m => typeof m === 'string' && m.length > 0);
}

export function getGoogleDoc(documentId: string) {
	return new Promise((resolve) => {
		docs.documents.get({ documentId: documentId },
			(err, res) => {
				if (err) {
					console.error('Error:', err);
					resolve(void 0);
				}
				resolve(res?.data)
			}
		);
	})
}

export function getGoogleDocImage(documentId: string): Promise<void | string[]> {
	console.log('Fetching Google Doc image links');
	return new Promise((resolve) => {
		docs.documents.get({ documentId: documentId },
			(err, res) => {
				if (err) {
					console.error('|-> Error:', err);
					resolve(void 0)
				}

				const positionedImgObj = res?.data.positionedObjects;
				const inlineImgObj = res?.data.inlineObjects;
				const all = []
				if (positionedImgObj) {
					const imgKeys = Object.keys(positionedImgObj);
					const imgLinks = imgKeys.map(k=>positionedImgObj[k]?.positionedObjectProperties?.embeddedObject?.imageProperties);
					all.push(...imgLinks);
					console.log('|-> Found image links:', imgLinks);
				}

				if (inlineImgObj) {
					const imgKeys = Object.keys(inlineImgObj);
					const imgLinks = imgKeys.map(k=>inlineImgObj[k]?.inlineObjectProperties?.embeddedObject?.imageProperties);
					console.log('|-> Found image links:', imgLinks);
					all.push(...imgLinks);
				}

				resolve(all.map(i => i?.contentUri).filter(m => typeof m === 'string') as string[]);
			}
		);
	});
}

export function getGoogleDocContent(documentId: string): Promise<Error | null | string>{
	const story: string[] = [];
	return new Promise((resolve) => {
		docs.documents.get({ documentId: documentId },
			(err, res) => {
				if (err) {
					console.error('Error:', err);
					resolve(err)
				}
	
				const content = res?.data.body?.content;
				content?.forEach((structuralElement) => {
					if (structuralElement.paragraph && structuralElement.paragraph.elements) {
						story.push(...readParagraph(structuralElement.paragraph));
					}
	
					if (structuralElement.table) {
						story.push(...readTable(structuralElement.table))
					}
				});

				resolve(story.join(''));
			}
		);
	})
}
