const _ = require('lodash');
import DataObject from '../models/data-object';


export default async function dedupeObject(object, fields, query) {
  if(!object || !object.content) {
    console.debug('Content or dataObject not set', object);
    return object;
  }

  const {content} = object;

  const returnObject = Object.assign({}, object);

    for (let i = 0; i < fields.length; i += 1) {
      const cursor = DataObject.find(query).lean().cursor();
      for (let doc = await cursor.next(); doc !== null; doc = await cursor.next()) {

        const compareContent = doc.content;
        let isDupe = false;

        if (_.isEqual(content, compareContent)) {
          isDupe = true;
          if (fields[i].autoDeleteDuplicacte) {
            if (fields[i].mergeRefs) {
              returnObject.refs = returnObject.refs.concat(doc.refs || []);
            }
            await DataObject.findOneAndDelete({_id: doc._id});
          } else {
            returnObject.meta.knownDuplicates.push(doc._id.toString());
          }
        }

        if (fields[i].checkSubset && !isDupe && _.isMatch(content, compareContent)) {
          if (fields[i].autoDeleteSubset) {
            if (fields[i].mergeRefs) {
              returnObject.refs = returnObject.refs.concat(doc.refs || []);
            }
            await DataObject.findOneAndDelete({_id: doc._id});
          } else {
            returnObject.meta.knownSubsets.push(doc._id.toString());
          }
        }
      }
    }


  return returnObject;
}
