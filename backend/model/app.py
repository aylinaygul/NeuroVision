import base64
from flask import Flask, request, jsonify, send_file, Response
from flask_cors import CORS
import zipfile
import numpy as np
import cv2
import nibabel as nib
import tensorflow as tf
import matplotlib.pyplot as plt
from io import BytesIO
from PIL import Image
from werkzeug.utils import secure_filename
import keras.backend as K
import os
from skimage.measure import label, regionprops

app = Flask(__name__)
CORS(app)

# Constants for preprocessing
VOLUME_SLICES = 155  # Adjust based on your data
IMG_SIZE = 128  # Assuming your model expects 128x128 input images
VOLUME_START_AT = 0  # Start slice index

# Define the custom metrics
def dice_coef(y_true, y_pred, smooth=1.0):
    class_num = 4
    total_loss = 0
    for i in range(class_num):
        y_true_f = K.flatten(y_true[:, :, :, i])
        y_pred_f = K.flatten(y_pred[:, :, :, i])
        intersection = K.sum(y_true_f * y_pred_f)
        loss = (2. * intersection + smooth) / (K.sum(y_true_f) + K.sum(y_pred_f) + smooth)
        total_loss += loss
    total_loss /= class_num
    return total_loss

def dice_coef_necrotic(y_true, y_pred, epsilon=1e-6):
    intersection = K.sum(K.abs(y_true[:, :, :, 1] * y_pred[:, :, :, 1]))
    return (2. * intersection) / (K.sum(K.square(y_true[:, :, :, 1])) + K.sum(K.square(y_pred[:, :, :, 1])) + epsilon)

def dice_coef_edema(y_true, y_pred, epsilon=1e-6):
    intersection = K.sum(K.abs(y_true[:, :, :, 2] * y_pred[:, :, :, 2]))
    return (2. * intersection) / (K.sum(K.square(y_true[:, :, :, 2])) + K.sum(K.square(y_pred[:, :, :, 2])) + epsilon)

def dice_coef_enhancing(y_true, y_pred, epsilon=1e-6):
    intersection = K.sum(K.abs(y_true[:, :, :, 3] * y_pred[:, :, :, 3]))
    return (2. * intersection) / (K.sum(K.square(y_true[:, :, :, 3])) + K.sum(K.square(y_pred[:, :, :, 3])) + epsilon)

def precision(y_true, y_pred):
    true_positives = K.sum(K.round(K.clip(y_true * y_pred, 0, 1)))
    predicted_positives = K.sum(K.round(K.clip(y_pred, 0, 1)))
    return true_positives / (predicted_positives + K.epsilon())

def sensitivity(y_true, y_pred):
    true_positives = K.sum(K.round(K.clip(y_true * y_pred, 0, 1)))
    possible_positives = K.sum(K.round(K.clip(y_true, 0, 1)))
    return true_positives / (possible_positives + K.epsilon())

def specificity(y_true, y_pred):
    true_negatives = K.sum(K.round(K.clip((1-y_true) * (1-y-pred), 0, 1)))
    possible_negatives = K.sum(K.round(K.clip(1-y-true, 0, 1)))
    return true_negatives / (possible_negatives + K.epsilon())

# Load the model with the custom metrics
model = tf.keras.models.load_model('model_2019_350.h5',
                                   custom_objects={
                                       'dice_coef': dice_coef,
                                       'dice_coef_necrotic': dice_coef_necrotic,
                                       'dice_coef_edema': dice_coef_edema,
                                       'dice_coef_enhancing': dice_coef_enhancing,
                                       'precision': precision,
                                       'sensitivity': sensitivity,
                                       'specificity': specificity,
                                       'accuracy': tf.keras.metrics.MeanIoU(num_classes=4)
                                   }, compile=False)

def predictFromUploadedZipInMemory(zip_file, zip_name):
    try:
        # Read the uploaded zip file from memory
        z = zipfile.ZipFile(zip_file, 'r')
        # Extract all contents to a temporary directory in memory
        extracted_files = {name: z.read(name) for name in z.namelist()}
        print(extracted_files.keys())

        # Load and prepare the data
        X = np.empty((VOLUME_SLICES, IMG_SIZE, IMG_SIZE, 2))

        # Load flair.nii
        flair_bytes = extracted_files[f'{zip_name}/{zip_name}_flair.nii']
        flair = nib.Nifti1Image.from_bytes(flair_bytes).get_fdata()

        # Load t1ce.nii
        ce_bytes = extracted_files[f'{zip_name}/{zip_name}_t1ce.nii']
        ce = nib.Nifti1Image.from_bytes(ce_bytes).get_fdata()

        for j in range(VOLUME_SLICES):
            X[j,:,:,0] = cv2.resize(flair[:,:,j+VOLUME_START_AT], (IMG_SIZE,IMG_SIZE))
            X[j,:,:,1] = cv2.resize(ce[:,:,j+VOLUME_START_AT], (IMG_SIZE,IMG_SIZE))

        # Make predictions
        predictions = model.predict(X / np.max(X), verbose=1)

        return predictions
    except Exception as e:
        print(f"Error in predictFromUploadedZipInMemory: {e}")
        raise

def find_tumor_properties(predictions):
    tumor_properties = []

    try:
        for i in range(predictions.shape[0]):
            # Apply threshold to create binary mask
            binary_mask = (predictions[i, :, :, 1:] > 0.5).astype(np.uint8)

            # Perform connected component analysis
            labeled_mask = label(binary_mask)

            # Measure properties of labeled regions
            regions = regionprops(labeled_mask)

            for region in regions:
                # Calculate the bounding box
                if len(region.bbox) == 6:  # Handling 3D bounding box (min_row, min_col, min_depth, max_row, max_col, max_depth)
                    minr, minc, mind, maxr, maxc, maxd = region.bbox
                    bounding_box = (minr, minc, mind, maxr, maxc, maxd)
                    center_x, center_y, center_z = region.centroid
                else:  # Handling 2D bounding box (min_row, min_col, max_row, max_col)
                    minr, minc, maxr, maxc = region.bbox
                    bounding_box = (minr, minc, maxr, maxc)
                    center_x, center_y = region.centroid

                # Calculate the size (area) of the tumor
                size = region.area

                tumor_properties.append({
                    "slice_index": i,
                    "bounding_box": bounding_box,
                    "size": size,
                    "center": (center_x, center_y),
                    "width": maxc - minc,
                    "height": maxr - minr
                })

        return tumor_properties
    except Exception as e:
        print(f"Error in find_tumor_properties: {e}")
        raise

def showPredictsByUploadedZip(predictions, zip_file, zip_name):
    SEGMENT_CLASSES = ['background', 'necrotic', 'edema', 'enhancing']

    try:
        
        z = zipfile.ZipFile(zip_file, 'r')

        # Extract flair.nii for original image visualization
        flair_bytes = z.read(f'{zip_name}/{zip_name}_flair.nii')
        flair = nib.Nifti1Image.from_bytes(flair_bytes).get_fdata()

        # Generate a subplot figure for visualization
        fig, axarr = plt.subplots(1, 4, figsize=(12, 4))

        for i in range(4):
            slice_index = VOLUME_START_AT + i
            if slice_index < flair.shape[2]:
                axarr[i].imshow(cv2.resize(flair[:,:,slice_index], (IMG_SIZE, IMG_SIZE)), cmap="gray", interpolation='none')
                axarr[i].axis('off')

        start_slice = VOLUME_START_AT + 60  # Adjust based on the specific slice you want to visualize

        axarr[0].imshow(cv2.resize(flair[:,:,start_slice], (IMG_SIZE, IMG_SIZE)), cmap="gray", interpolation='none')
        axarr[0].imshow(predictions[start_slice,:,:,1:4].sum(axis=-1), cmap="Reds", interpolation='none', alpha=0.3)
        axarr[0].set_title('All Classes')

        axarr[1].imshow(cv2.resize(flair[:,:,start_slice], (IMG_SIZE, IMG_SIZE)), cmap="gray", interpolation='none')
        axarr[1].imshow(predictions[start_slice,:,:,1], cmap="OrRd", interpolation='none', alpha=0.3)
        axarr[1].set_title(f'{SEGMENT_CLASSES[1]} Predicted')

        axarr[2].imshow(cv2.resize(flair[:,:,start_slice], (IMG_SIZE, IMG_SIZE)), cmap="gray", interpolation='none')
        axarr[2].imshow(predictions[start_slice,:,:,2], cmap="OrRd", interpolation='none', alpha=0.3)
        axarr[2].set_title(f'{SEGMENT_CLASSES[2]} Predicted')

        axarr[3].imshow(cv2.resize(flair[:,:,start_slice], (IMG_SIZE, IMG_SIZE)), cmap="gray", interpolation='none')
        axarr[3].imshow(predictions[start_slice,:,:,3], cmap="OrRd", interpolation='none', alpha=0.3)
        axarr[3].set_title(f'{SEGMENT_CLASSES[3]} Predicted')

        plt.tight_layout()
        output_filename = f'{zip_name}.png'
        plt.savefig(output_filename)
        plt.close(fig)  # Close the figure to free up memory

        return output_filename
    except Exception as e:
        print(f"Error in showPredictsByUploadedZip: {e}")
        raise

def create_gpt3_prompt(tumor_properties):
    avg_center_x = np.mean([prop['center'][0] for prop in tumor_properties])
    avg_center_y = np.mean([prop['center'][1] for prop in tumor_properties])
    avg_size = np.mean([prop['size'] for prop in tumor_properties])
    avg_width = np.mean([prop['width'] for prop in tumor_properties])
    avg_height = np.mean([prop['height'] for prop in tumor_properties])

    prompt = (
        f"Hello GPT-3, I have some data about brain tumor detection and I would like to get information about what this data means. "
        f"Provide information about the brain tumor detected in the MR image: The tumor is located at coordinates {avg_center_x:.2f} x {avg_center_y:.2f}. "
        f"The size of the tumor is approximately {avg_size:.2f} pixels square, {avg_width:.2f} pixels wide and {avg_height:.2f} pixels high. "
        "Based on your medical knowledge, what kind of tumor could this be and what dangers could it pose? Please provide detailed information."
    )

    return prompt

@app.route('/predict', methods=['POST'])
def predict():
    print('Predicting...')
    filename = request.form['filename']
    print(filename)
    try:
        # Check if POST request contains a file
        if 'file' not in request.files:
            print('No file part in the request')
            return jsonify({'error': 'No file part in the request'}), 400
        
        file = request.files['file']

        if file.filename == '':
            print('No selected file')
            return jsonify({'error': 'No selected file'}), 400
        
        if file:
            print('File received')
            # Perform prediction using your function
            predictions = predictFromUploadedZipInMemory(file, filename)

            # Find tumor properties
            tumor_properties = find_tumor_properties(predictions)

            # Create GPT-3 prompt
            prompt = create_gpt3_prompt(tumor_properties)

            # Generate and save visualization image
            output_filename = showPredictsByUploadedZip(predictions, file, filename)

            # Read and encode the image to base64
            with open(output_filename, "rb") as image_file:
                encoded_image = base64.b64encode(image_file.read()).decode('utf-8')

            # Prepare the response
            response = {
                "image": encoded_image,
                "tumor_properties": tumor_properties,
                "gpt3_prompt": prompt
            }

            # Delete the generated image file
            os.remove(output_filename)

            return jsonify(response), 200
    
    except Exception as e:
        print(f"Error in /predict route: {e}")
        return jsonify({'error': str(e)}), 500

@app.errorhandler(500)
def internal_server_error(e):
    return jsonify(error=str(e)), 500

if __name__ == '__main__':
    app.run(debug=True)
