document.addEventListener('DOMContentLoaded', function() {
	// Function to recalculate bounding boxes if necessary on window resize
	function recalculateFPDBoxes() {
		const items = document.querySelectorAll('.fpd-catalog-item');
		
		items.forEach(item => {
			const baseImg = item.querySelector('.fpd-base-layer');
			const designWrapper = item.querySelector('.fpd-design-layer-wrapper');
			
			if (baseImg && designWrapper) {
				// If using percentage based calculations, we might need to adjust 
				// based on the rendered width of the base image.
				// This is a placeholder for advanced DOM recalculations if inline CSS isn't enough.
				
				/* Example:
				const baseWidth = baseImg.clientWidth;
				const baseHeight = baseImg.clientHeight;
				const naturalWidth = baseImg.naturalWidth;
				
				if(naturalWidth > 0) {
					const ratio = baseWidth / naturalWidth;
					// Adjust design wrapper based on ratio
				}
				*/
			}
		});
	}

	window.addEventListener('resize', recalculateFPDBoxes);
	
	// Initial calculation after images load
	window.addEventListener('load', recalculateFPDBoxes);
});
